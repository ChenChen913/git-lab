import type { CommandResult, OutputLine, ParsedCommand, Repository } from '../../types';
import {
  activeWt,
  ancestors,
  applyTree,
  headCommit,
  headCommitId,
  headTree,
  mergeBase,
} from '../repository';
import { conflictMarkers } from '../text';
import {
  fail,
  fileSummary,
  firstLine,
  hasFlag,
  makeCommit,
  mergeTrees,
  moveBranch,
  notARepo,
  positional,
  type Tree,
} from './util';
import { sameLines, sameTree } from './basic';

function hashOf(next: Repository, id: string | null): string {
  return id ? next.commits[id]?.hash ?? '' : '';
}

// ---------- git branch ----------

export function cmdBranch(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const pos = positional(parsed);

  if (hasFlag(parsed, '-d')) {
    const name = pos[0];
    if (!name || !repo.branches[name]) {
      return fail({ kind: 'error', text: `error: branch '${name ?? ''}' not found.` });
    }
    if (wt.head.branch === name) {
      return fail(
        { kind: 'error', text: `error: Cannot delete branch '${name}' checked out at '${wt.label}'` },
        { kind: 'hint', text: '提示：先 git switch 到别的分支，再删除它' },
      );
    }
    const occupied = repo.worktrees.find((w) => w.head.branch === name);
    if (occupied) {
      return fail({ kind: 'error', text: `error: 分支 '${name}' 正被 worktree '${occupied.label}' 使用，无法删除` });
    }
    const wasHash = hashOf(repo, repo.branches[name].commitId);
    const next = structuredClone(repo);
    delete next.branches[name];
    return {
      repo: next,
      output: [{ kind: 'success', text: `Deleted branch ${name} (was ${wasHash}).` }],
      ops: [{ type: 'BRANCH_DELETED', name }],
    };
  }

  if (!pos[0]) {
    const output: OutputLine[] = [];
    const sorted = Object.values(repo.branches).sort((a, b) => (b.name === wt.head.branch ? 1 : 0) - (a.name === wt.head.branch ? 1 : 0));
    for (const b of sorted) {
      const current = b.name === wt.head.branch;
      const occupiedElsewhere = repo.worktrees.some((w) => w.head.branch === b.name && w.id !== wt.id);
      const mark = current ? '* ' : occupiedElsewhere ? '+ ' : '  ';
      output.push({ kind: current ? 'success' : 'info', text: `${mark}${b.name}` });
    }
    output.push({ kind: 'hint', text: '* 当前分支；+ 该分支正在另一个 worktree 中打开' });
    return { repo: null, output, ops: [] };
  }

  const name = pos[0];
  if (repo.branches[name]) {
    return fail({ kind: 'error', text: `fatal: a branch named '${name}' already exists` });
  }
  const headId = headCommitId(repo, wt);
  if (!headId) {
    return fail(
      { kind: 'error', text: `fatal: not a valid object name: '${wt.head.branch ?? 'HEAD'}'` },
      { kind: 'hint', text: '提示：还没有任何提交，先 git add + git commit，再创建分支' },
    );
  }
  const next = structuredClone(repo);
  next.branches[name] = { name, commitId: headId };
  return {
    repo: next,
    output: [
      { kind: 'success', text: `✓ 已创建分支 ${name}（贴在 ${hashOf(next, headId)} 上）` },
      { kind: 'hint', text: `发生了什么：分支只是一个指向当前提交的标签；当前仍停留在 ${wt.head.branch}，git switch -c ${name} 可创建并切换` },
    ],
    ops: [{ type: 'BRANCH_CREATED', name }],
  };
}

// ---------- git switch / git checkout -b ----------

export function cmdSwitch(repo: Repository, parsed: ParsedCommand, create: boolean): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const name = positional(parsed)[0];
  if (!name) {
    return fail({ kind: 'error', text: 'usage: git switch <分支名>；创建并切换：git switch -c <分支名>' });
  }
  if (wt.mergeState) {
    return fail(
      { kind: 'error', text: 'error: you need to resolve your current merge first.' },
      { kind: 'hint', text: '提示：解决冲突后 commit，或 git merge --abort 放弃' },
    );
  }
  if (wt.rebaseState) {
    return fail({ kind: 'error', text: 'error: 变基进行中，不能切换分支（先 --continue 或 --abort）' });
  }

  const next = structuredClone(repo);
  const nwt = activeWt(next);

  if (create) {
    if (next.branches[name]) {
      return fail({ kind: 'error', text: `fatal: a branch named '${name}' already exists` });
    }
    const headId = headCommitId(next, nwt);
    next.branches[name] = { name, commitId: headId };
    nwt.head = { kind: 'branch', branch: name };
    return {
      repo: next,
      output: [
        { kind: 'success', text: `Switched to a new branch '${name}'` },
        { kind: 'hint', text: '发生了什么：新分支贴在原分支所在的同一个提交上——并没有复制任何代码，文件自然一模一样' },
      ],
      ops: [{ type: 'BRANCH_CREATED', name }, { type: 'HEAD_MOVED', branch: name }],
    };
  }

  const target = next.branches[name];
  if (!target) {
    return fail(
      { kind: 'error', text: `fatal: invalid reference: ${name}` },
      { kind: 'hint', text: '提示：分支不存在；新建分支用 git switch -c <名字>' },
    );
  }
  if (wt.head.branch === name) {
    return fail({ kind: 'muted', text: `Already on '${name}'` });
  }

  // 覆盖保护：未提交改动会被目标分支覆盖时拒绝切换
  const curTree = headTree(next, nwt);
  const targetTree: Tree = target.commitId ? next.commits[target.commitId].tree : {};
  const blockedStaged: string[] = [];
  const blockedWork: string[] = [];
  const blockedUntracked: string[] = [];
  const paths = new Set([...Object.keys(curTree), ...Object.keys(nwt.index), ...Object.keys(nwt.workingFiles)]);
  for (const p of paths) {
    const stagedChanged = p in nwt.index && !sameLines(nwt.index[p], curTree[p]);
    const workChanged =
      p in nwt.workingFiles &&
      !sameLines(nwt.workingFiles[p], p in nwt.index ? nwt.index[p] : curTree[p]);
    const untracked = p in nwt.workingFiles && !(p in nwt.index) && !(p in curTree);
    const dest = targetTree[p];
    if (untracked && dest) blockedUntracked.push(p);
    else if (stagedChanged && !sameLines(dest, nwt.workingFiles[p])) blockedStaged.push(p);
    else if (workChanged && !sameLines(dest, nwt.workingFiles[p])) blockedWork.push(p);
  }
  const blocked = [...blockedUntracked, ...blockedStaged, ...blockedWork];
  if (blocked.length) {
    return fail(
      { kind: 'error', text: 'error: Your local changes to the following files would be overwritten by checkout:' },
      ...blocked.map((p) => ({ kind: 'error' as const, text: `\t${p}` })),
      { kind: 'error', text: 'Please commit your changes or stash them before you switch branches.' },
      { kind: 'hint', text: '提示：Git 不敢覆盖你未提交的改动。可以先 commit；或 git stash 收起来，切过去忙完再 pop 回来' },
    );
  }

  applyTree(next, nwt, targetTree, true);
  nwt.head = { kind: 'branch', branch: name };
  const output: OutputLine[] = [{ kind: 'success', text: `Switched to branch '${name}'` }];
  if (!target.commitId) output.push({ kind: 'muted', text: '（该分支还没有任何提交）' });
  return { repo: next, output, ops: [{ type: 'HEAD_MOVED', branch: name }] };
}

// ---------- git merge ----------

export function cmdMerge(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);

  if (hasFlag(parsed, '--abort')) {
    if (!wt.mergeState) return fail({ kind: 'error', text: 'fatal: There is no merge to abort' });
    const next = structuredClone(repo);
    const nwt = activeWt(next);
    applyTree(next, nwt, headTree(next, nwt), false);
    nwt.mergeState = null;
    return {
      repo: next,
      output: [{ kind: 'success', text: '已放弃本次合并（merge --abort），工作区与暂存区恢复到合并前' }],
      ops: [{ type: 'MERGE_ABORTED' }],
    };
  }

  const name = positional(parsed)[0];
  if (!name) return fail({ kind: 'error', text: 'usage: git merge <分支名>；放弃合并：git merge --abort' });
  if (wt.rebaseState) {
    return fail({ kind: 'error', text: 'error: 变基进行中，请先完成或放弃变基' });
  }
  if (wt.mergeState) {
    return fail(
      { kind: 'error', text: 'error: Merging is not possible because you have unmerged files.' },
      { kind: 'hint', text: '提示：解决冲突并 commit 完成合并，或 git merge --abort 放弃' },
    );
  }
  const theirsBranch = repo.branches[name];
  if (!theirsBranch || !theirsBranch.commitId) {
    return fail({ kind: 'error', text: `merge: ${name} - not something we can merge` });
  }
  const oursTip = headCommitId(repo, wt);
  if (!oursTip) {
    return fail({ kind: 'error', text: 'fatal: 当前分支还没有任何提交，无法合并' });
  }
  const theirsTip = theirsBranch.commitId;
  const curBranch = wt.head.branch!;

  // Already up to date：theirs 已包含在当前历史里
  if (ancestors(repo, oursTip).has(theirsTip)) {
    return fail({ kind: 'muted', text: 'Already up to date.' });
  }

  // Fast-forward：当前分支是 theirs 的祖先，直接把指针挪过去
  if (ancestors(repo, theirsTip).has(oursTip)) {
    const next = structuredClone(repo);
    const nwt = activeWt(next);
    const targetTree = next.commits[theirsTip].tree;
    applyTree(next, nwt, targetTree, true);
    moveBranch(next, curBranch, theirsTip);
    return {
      repo: next,
      output: [
        { kind: 'muted', text: `Updating ${hashOf(repo, oursTip)}..${hashOf(repo, theirsTip)}` },
        { kind: 'success', text: 'Fast-forward' },
        { kind: 'muted', text: fileSummary(headTree(repo, wt), targetTree) },
        { kind: 'hint', text: '发生了什么：被合并分支正好接在当前分支后面，master 直接"快进"到它——没有产生新提交' },
      ],
      ops: [{ type: 'BRANCH_MOVED', name: curBranch, toCommitId: theirsTip, mode: 'ff' }],
    };
  }

  // 真分叉：三方比较
  const baseId = mergeBase(repo, oursTip, theirsTip)!;
  const baseTree: Tree = next0Tree(repo, baseId);
  const oursTree = headTree(repo, wt);
  const theirsTree = repo.commits[theirsTip].tree;
  const { merged, conflicts } = mergeTrees(baseTree, oursTree, theirsTree);

  const next = structuredClone(repo);
  const nwt = activeWt(next);

  if (Object.keys(conflicts).length === 0) {
    const commit = makeCommit(next, {
      message: `Merge branch '${name}'`,
      tree: merged,
      parents: [oursTip, theirsTip],
      merge: true,
    });
    moveBranch(next, curBranch, commit.id);
    // 工作区与暂存区同步合并结果（对齐真实 git 的行为）
    for (const [p, content] of Object.entries(merged)) {
      if (!sameLines(content, oursTree[p])) nwt.workingFiles[p] = content;
    }
    nwt.index = { ...merged };
    return {
      repo: next,
      output: [
        { kind: 'success', text: `Merge made by the 'ort' strategy.` },
        { kind: 'muted', text: fileSummary(oursTree, merged) },
        { kind: 'hint', text: '发生了什么：Git 新造了一个合并提交，它同时接在两条分支的最新提交后面（有两个父提交）' },
      ],
      ops: [{ type: 'COMMIT_CREATED', commitId: commit.id }],
    };
  }

  const conflictPaths = Object.keys(conflicts);
  nwt.mergeState = {
    theirsBranch: name,
    theirsCommitId: theirsTip,
    baseCommitId: baseId,
    conflicts: Object.fromEntries(
      Object.entries(conflicts).map(([p, c]) => [p, { ...c, path: p, resolved: false }]),
    ),
  };
  for (const p of conflictPaths) {
    nwt.workingFiles[p] = conflictMarkers(conflicts[p].ours, conflicts[p].theirs, name);
  }
  for (const [p, content] of Object.entries(merged)) {
    if (!conflicts[p] && !sameLines(content, oursTree[p])) nwt.index[p] = content;
  }
  return {
    repo: next,
    output: [
      { kind: 'info', text: `Auto-merging ${conflictPaths[0]}` },
      ...conflictPaths.map((p) => ({ kind: 'error' as const, text: `CONFLICT (content): Merge conflict in ${p}` })),
      { kind: 'error', text: 'Automatic merge failed; fix conflicts and then commit the result.' },
      { kind: 'hint', text: '为什么会冲突：两条分支改了同一个位置、内容还不一样，Git 不知道该留哪边' },
      { kind: 'hint', text: '下一步：在冲突面板查看双方版本并解决 → git add . → git commit 完成合并' },
    ],
    ops: [{ type: 'CONFLICT_CREATED', paths: conflictPaths, theirsBranch: name }],
  };
}

function next0Tree(repo: Repository, id: string | null): Tree {
  return id ? repo.commits[id].tree : {};
}
