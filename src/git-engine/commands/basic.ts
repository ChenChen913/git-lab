import type { CommandResult, OutputLine, ParsedCommand, Repository, Worktree } from '../../types';
import { diffLines } from '../text';
import {
  activeWt,
  aheadBehind,
  authorLine,
  cloneTree,
  DEFAULT_BRANCH,
  fileStatuses,
  headCommit,
  headCommitId,
  headTree,
  isIgnored,
  resolveCommitish,
  statusGroups,
} from '../repository';
import {
  fail,
  fileSummary,
  firstLine,
  flagValue,
  hasFlag,
  makeCommit,
  notARepo,
  positional,
  type Tree,
} from './util';

function sameLines(a?: string[], b?: string[]): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((l, i) => l === b[i]);
}

function sameTree(a: Tree, b: Tree): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (!sameLines(a[k], b[k])) return false;
  return true;
}

// ---------- git init ----------

export function cmdInit(repo: Repository): CommandResult {
  const next = structuredClone(repo);
  if (next.initialized) {
    return fail({ kind: 'muted', text: 'Reinitialized existing Git repository（仓库已存在，状态无变化）' });
  }
  next.initialized = true;
  next.branches[DEFAULT_BRANCH] = { name: DEFAULT_BRANCH, commitId: null };
  const wt = activeWt(next);
  wt.head = { kind: 'branch', branch: DEFAULT_BRANCH };
  return {
    repo: next,
    output: [
      { kind: 'success', text: `Initialized empty Git repository in D:/projects/${wt.label}/.git/` },
      { kind: 'hint', text: '发生了什么：当前目录被初始化为 Git 仓库（创建了 .git 文件夹），默认分支 master 与 HEAD 已就位' },
      { kind: 'hint', text: '下一步：git status 查看状态 → git add 选择文件 → git commit -m "说明" 保存版本' },
    ],
    ops: [{ type: 'REPO_INITIALIZED' }],
  };
}

// ---------- git status ----------

export function statusLines(repo: Repository, wt: Worktree): OutputLine[] {
  const lines: OutputLine[] = [];
  const branch = wt.head.branch ?? 'HEAD (detached)';
  lines.push({ kind: 'meta', text: `On branch ${branch}` });
  const g = statusGroups(repo, wt);
  const headId = headCommitId(repo, wt);
  if (!headId) lines.push({ kind: 'muted', text: 'No commits yet' });

  if (wt.mergeState) {
    lines.push({ kind: 'error', text: 'You have unmerged paths.' });
    lines.push({ kind: 'hint', text: '  (fix conflicts and run "git commit")' });
    lines.push({ kind: 'hint', text: '  (use "git merge --abort" to abort the merge)' });
  } else if (wt.rebaseState) {
    lines.push({ kind: 'error', text: 'You are currently in the middle of a rebase.' });
    lines.push({ kind: 'hint', text: '  (fix conflicts, "git add <file>...", then run "git rebase --continue")' });
  }

  const ab = aheadBehind(repo, wt.head.branch ?? '');
  if (ab && ab.ahead > 0) {
    lines.push({
      kind: 'hint',
      text: `Your branch is ahead of 'origin/${branch}' by ${ab.ahead} commit${ab.ahead > 1 ? 's' : ''}. (use "git push" to publish)`,
    });
  } else if (ab && ab.behind > 0) {
    lines.push({ kind: 'hint', text: `Your branch is behind 'origin/${branch}' by ${ab.behind} commit${ab.behind > 1 ? 's' : ''}. (use "git pull" to update)` });
  }

  const label = (s: string) => `    ${s.padEnd(12)} `;
  if (g.staged.length) {
    lines.push({ kind: 'meta', text: 'Changes to be committed:' });
    lines.push({ kind: 'hint', text: '  (use "git restore --staged <file>..." to unstage)' });
    for (const f of g.staged) {
      const extra = f.status === 'staged+modified' ? '（之后又有新改动，见下方）' : '';
      lines.push({ kind: 'success', text: `${label('modified:')}${f.path}${extra}` });
    }
    lines.push({ kind: 'muted', text: '' });
  }
  if (g.unstaged.length) {
    lines.push({ kind: 'meta', text: 'Changes not staged for commit:' });
    lines.push({ kind: 'hint', text: '  (use "git add <file>..." to update what will be committed)' });
    lines.push({ kind: 'hint', text: '  (use "git restore <file>..." to discard changes in working directory)' });
    for (const f of g.unstaged) lines.push({ kind: 'info', text: `${label('modified:')}${f.path}` });
    lines.push({ kind: 'muted', text: '' });
  }
  if (g.untracked.length) {
    lines.push({ kind: 'meta', text: 'Untracked files:' });
    lines.push({ kind: 'hint', text: '  (use "git add <file>..." to include in what will be committed)' });
    for (const f of g.untracked) lines.push({ kind: 'warn', text: `${label('')}${f.path}` });
    lines.push({ kind: 'muted', text: '' });
  }
  const ignored = fileStatuses(repo, wt).filter((f) => f.ignored);
  if (ignored.length) {
    lines.push({ kind: 'muted', text: 'Ignored files (.gitignore):' });
    for (const f of ignored) lines.push({ kind: 'muted', text: `${label('')}${f.path}` });
    lines.push({ kind: 'muted', text: '' });
  }

  if (!g.staged.length && !g.unstaged.length && !g.untracked.length) {
    lines.push({ kind: 'success', text: 'nothing to commit, working tree clean' });
  } else if (!g.staged.length) {
    lines.push({ kind: 'muted', text: 'no changes added to commit (use "git add" and/or "git commit -a")' });
  }
  return lines;
}

export function cmdStatus(repo: Repository): CommandResult {
  if (!repo.initialized) return notARepo();
  return { repo: null, output: statusLines(repo, activeWt(repo)), ops: [] };
}

// ---------- git add ----------

export function cmdAdd(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const pos = positional(parsed);
  const targets: string[] = [];
  const all = pos.length === 0 || pos.includes('.') || hasFlag(parsed, '-A', '--all');

  if (all) {
    for (const [p] of Object.entries(wt.workingFiles)) {
      if (!isIgnored(wt, p)) targets.push(p);
    }
  } else {
    for (const p of pos) {
      if (!(p in wt.workingFiles)) {
        return fail(
          { kind: 'error', text: `fatal: pathspec '${p}' did not match any files` },
          { kind: 'hint', text: '提示：文件名要与左侧文件列表一致；也可以用 git add . 添加全部改动' },
        );
      }
      if (isIgnored(wt, p)) {
        return fail(
          { kind: 'error', text: `fatal: The following paths are ignored by one of your .gitignore files:` },
          { kind: 'error', text: p },
          { kind: 'hint', text: 'hint: Use -f if you really want to add them.（被忽略的文件不会进入版本管理）' },
        );
      }
      targets.push(p);
    }
  }

  const changed = targets.filter((p) => !sameLines(wt.index[p], wt.workingFiles[p]));
  if (!changed.length) {
    return fail({ kind: 'muted', text: '（所选内容与暂存区一致，无变化）' });
  }
  const next = structuredClone(repo);
  const nwt = activeWt(next);
  for (const p of changed) nwt.index[p] = [...nwt.workingFiles[p]];
  return {
    repo: next,
    output: [
      ...changed.map((p) => ({ kind: 'success' as const, text: `✓ 已暂存 ${p}` })),
      { kind: 'hint', text: '发生了什么：文件内容被复制进暂存区；工作区文件本身没有任何变化' },
    ],
    ops: [{ type: 'FILE_STAGED', paths: changed }],
  };
}

// ---------- git commit ----------

export function cmdCommit(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const branch = wt.head.branch;
  if (!branch) return fail({ kind: 'error', text: 'fatal: 当前处于分离 HEAD 状态，无法提交（教学简化）' });
  const msg = flagValue(parsed, '-m');

  if (wt.rebaseState) {
    return fail(
      { kind: 'error', text: 'error: 变基（rebase）进行中，不能直接 commit' },
      { kind: 'hint', text: '提示：解决冲突并 git add 后，执行 git rebase --continue' },
    );
  }

  const hTree = headTree(repo, wt);

  if (wt.mergeState) {
    const unresolved = Object.values(wt.mergeState.conflicts).filter((c) => {
      const staged = wt.index[c.path];
      return !staged || staged.some((l) => l.startsWith('<<<<<<< ') || l.startsWith('>>>>>>> '));
    });
    if (unresolved.length) {
      return fail(
        { kind: 'error', text: 'error: Committing is not possible because you have unmerged files.' },
        { kind: 'hint', text: '提示：先在冲突面板解决冲突，然后 git add . 再次 commit' },
      );
    }
    const message = msg ?? `Merge branch '${wt.mergeState.theirsBranch}'`;
    const tree = cloneTree(hTree);
    for (const [k, v] of Object.entries(wt.index)) tree[k] = v;
    const next = structuredClone(repo);
    const nwt = activeWt(next);
    const parents = [headCommitId(next, nwt)!, wt.mergeState!.theirsCommitId];
    const commit = makeCommit(next, { message, tree, parents, merge: true, branch });
    moveBranchLocal(next, branch, commit.id);
    nwt.index = cloneTree(tree);
    nwt.mergeState = null;
    return {
      repo: next,
      output: [
        { kind: 'success', text: `[${branch} ${commit.hash}] ${firstLine(message)}` },
        { kind: 'muted', text: fileSummary(hTree, tree) },
        { kind: 'hint', text: '发生了什么：合并提交有两个父提交，两条分支的历史在这里汇成一条' },
      ],
      ops: [{ type: 'COMMIT_CREATED', commitId: commit.id }],
    };
  }

  const stagedChanged = Object.keys(wt.index).filter(
    (p) => p in wt.index && !sameLines(wt.index[p], hTree[p]),
  );
  if (!stagedChanged.length) {
    const workingDirty = fileStatuses(repo, wt).some(
      (f) => !f.ignored && (f.status === 'untracked' || f.status === 'modified'),
    );
    return fail(
      { kind: 'muted', text: workingDirty ? 'no changes added to commit' : 'nothing to commit, working tree clean' },
      { kind: 'hint', text: workingDirty ? '提示：暂存区是空的，先 git add 把改动放进暂存区' : '提示：工作区和暂存区都没有改动，先修改文件再提交' },
    );
  }
  if (!msg) {
    return fail(
      { kind: 'error', text: 'Aborting commit due to empty commit message.' },
      { kind: 'hint', text: '用法：git commit -m "这次提交做了什么"' },
    );
  }

  const tree = cloneTree(hTree);
  for (const [k, v] of Object.entries(wt.index)) tree[k] = v;
  const next = structuredClone(repo);
  const nwt = activeWt(next);
  const parentId = headCommitId(next, nwt);
  const commit = makeCommit(next, {
    message: msg,
    tree,
    parents: parentId ? [parentId] : [],
    branch,
  });
  moveBranchLocal(next, branch, commit.id);
  nwt.index = cloneTree(tree);
  return {
    repo: next,
    output: [
      { kind: 'success', text: `[${branch}${parentId ? '' : ' (root-commit)'} ${commit.hash}] ${firstLine(msg)}` },
      { kind: 'muted', text: fileSummary(hTree, tree) },
      { kind: 'hint', text: '发生了什么：暂存区内容被打包成一个 commit，分支指针前移指向它' },
    ],
    ops: [{ type: 'COMMIT_CREATED', commitId: commit.id }],
  };
}

function moveBranchLocal(next: Repository, branch: string, commitId: string) {
  if (next.branches[branch]) next.branches[branch].commitId = commitId;
}

// ---------- git log ----------

export function cmdLog(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const start = resolveCommitish(repo, wt, positional(parsed)[0]);
  if (!start) {
    return fail({ kind: 'error', text: `fatal: your current branch '${wt.head.branch ?? 'HEAD'}' does not have any commits yet` });
  }
  const oneline = hasFlag(parsed, '--oneline');
  // 收集 start 可达的所有 commit，按创建时间倒序
  const seen = new Set<string>();
  const stack = [start.id];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(repo.commits[id]?.parents ?? []));
  }
  const list = [...seen]
    .map((id) => repo.commits[id])
    .sort((a, b) => b.order - a.order);

  const decorations = (id: string): string => {
    const branches = Object.values(repo.branches).filter((b) => b.commitId === id).map((b) => b.name);
    const activeBranch = wt.head.branch;
    const withHead = branches.map((n) => (n === activeBranch ? `HEAD -> ${n}` : n));
    const otherWtHeads = repo.worktrees
      .filter((w) => w.id !== wt.id && w.head.branch && branches.includes(w.head.branch))
      .map((w) => `${w.head.branch} (${w.label})`);
    const all = [...withHead, ...otherWtHeads];
    return all.length ? ` (${all.join(', ')})` : '';
  };

  const output: OutputLine[] = [];
  for (const c of list) {
    if (oneline) {
      output.push({ kind: 'info', text: `${c.hash}${decorations(c.id)} ${firstLine(c.message)}` });
    } else {
      output.push({ kind: 'meta', text: `commit ${c.hash}${decorations(c.id)}` });
      output.push({ kind: 'muted', text: `Author: ${c.author}` });
      output.push({ kind: 'muted', text: '' });
      for (const l of c.message.split('\n')) output.push({ kind: 'info', text: `    ${l}` });
      output.push({ kind: 'muted', text: '' });
    }
  }
  output.push({ kind: 'hint', text: `共 ${list.length} 个提交；箭头/连线表示父子关系（越往上越新）` });
  return { repo: null, output, ops: [] };
}

// ---------- git diff ----------

export function cmdDiff(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const scope = hasFlag(parsed, '--staged') ? 'staged' : 'work';
  const hTree = headTree(repo, wt);
  const other = scope === 'staged' ? wt.index : wt.workingFiles;
  const paths = new Set([...Object.keys(hTree), ...Object.keys(other)]);
  const files = [];
  for (const p of [...paths].sort()) {
    if (isIgnored(wt, p)) continue;
    const rows = diffLines(hTree[p] ?? [], other[p] ?? []);
    if (rows.some((r) => r.type !== 'same')) files.push({ path: p, rows });
  }
  if (!files.length) {
    return fail({
      kind: 'muted',
      text: scope === 'staged' ? '（暂存区与最新提交一致，没有改动）' : '（工作区与最新提交一致，没有改动）',
    });
  }
  const output: OutputLine[] = [];
  for (const f of files) {
    output.push({ kind: 'meta', text: `diff --git a/${f.path} b/${f.path}` });
    for (const r of f.rows) {
      if (r.type === 'add') output.push({ kind: 'add', text: `+ ${r.text}` });
      else if (r.type === 'del') output.push({ kind: 'del', text: `- ${r.text}` });
      else output.push({ kind: 'muted', text: `  ${r.text}` });
    }
  }
  output.push({ kind: 'hint', text: '＋ 新增的行　− 删除的行（右侧 Diff 面板有同样的内容）' });
  return {
    repo: null,
    output,
    ops: [{ type: 'HIGHLIGHT', target: 'diff' }],
    diff: { scope, files },
  };
}

// ---------- git config ----------

export function cmdConfig(repo: Repository, parsed: ParsedCommand): CommandResult {
  const pos = positional(parsed);
  const key = pos[0];
  if (!key) return fail({ kind: 'error', text: 'usage: git config <user.name | user.email> <值>' });
  if (!pos[1]) {
    const v = key === 'user.name' ? repo.config.userName : key === 'user.email' ? repo.config.userEmail : undefined;
    if (v === undefined) return fail({ kind: 'error', text: `error: 不支持的配置项 '${key}'（支持 user.name / user.email）` });
    return { repo: null, output: [{ kind: 'info', text: v }], ops: [] };
  }
  if (key !== 'user.name' && key !== 'user.email') {
    return fail({ kind: 'error', text: `error: 不支持的配置项 '${key}'（支持 user.name / user.email）` });
  }
  const next = structuredClone(repo);
  if (key === 'user.name') next.config.userName = pos[1];
  else next.config.userEmail = pos[1];
  return {
    repo: next,
    output: [{ kind: 'success', text: `✓ ${key} = ${pos[1]}（会记录进之后的每个 commit）` }],
    ops: [],
  };
}

// 导出给其他命令复用的工具
export { sameLines, sameTree };
