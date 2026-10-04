import type { CommandResult, OutputLine, ParsedCommand, Repository } from '../../types';
import { conflictMarkers } from '../text';
import {
  activeWt,
  ancestors,
  applyTree,
  headCommit,
  headCommitId,
  headTree,
  mergeBase,
  resolveCommitish,
  cloneTree,
  DEFAULT_BRANCH,
} from '../repository';
import { firstLine, fail, hasFlag, flagValue, mergeTrees, makeCommit, moveBranch, notARepo, positional, type Tree } from './util';
import { sameLines } from './basic';

function hashOf(repo: Repository, id: string | null): string {
  return id ? repo.commits[id]?.hash ?? '' : '';
}

// ---------- git stash ----------

export function cmdStash(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const sub = positional(parsed)[0]; // pop | list | undefined(=push)

  if (sub === 'list') {
    const mine = repo.stashes.filter((s) => s.worktreeId === wt.id);
    if (!mine.length) return fail({ kind: 'muted', text: '（stash 是空的）' });
    return {
      repo: null,
      output: mine.map((s, i) => ({ kind: 'info' as const, text: `stash@{${repo.stashes.length - 1 - i >= 0 ? repo.stashes.indexOf(s) : i}}: ${s.label}` })),
      ops: [],
    };
  }

  if (sub === 'pop') {
    const entry = repo.stashes.find((s) => s.worktreeId === wt.id);
    if (!entry) return fail({ kind: 'error', text: 'error: No stash entries found.' });
    const next = structuredClone(repo);
    const nwt = activeWt(next);
    for (const [p, c] of Object.entries(entry.files)) nwt.workingFiles[p] = [...c];
    for (const [p, c] of Object.entries(entry.indexFiles)) nwt.index[p] = [...c];
    next.stashes = next.stashes.filter((s) => s !== next.stashes.find((x) => x.seq === entry.seq));
    return {
      repo: next,
      output: [
        { kind: 'success', text: `✓ 已恢复 ${entry.label}` },
        { kind: 'hint', text: '发生了什么：收起的改动回到工作区（之前已暂存的部分回到暂存区），stash 条目随之消失' },
      ],
      ops: [{ type: 'STASH_POPPED' }],
    };
  }

  if (sub && sub !== 'push') {
    return fail({ kind: 'error', text: `usage: git stash [push] / git stash pop / git stash list` });
  }

  // push：收起未提交改动
  const hTree = headTree(repo, wt);
  const files: Tree = {};
  const indexFiles: Tree = {};
  for (const p of new Set([...Object.keys(wt.index), ...Object.keys(hTree)])) {
    if (!sameLines(wt.index[p], hTree[p])) indexFiles[p] = [...wt.index[p]];
    if (!sameLines(wt.workingFiles[p], wt.index[p] ?? hTree[p])) files[p] = [...wt.workingFiles[p]];
  }
  if (!Object.keys(files).length && !Object.keys(indexFiles).length) {
    return fail({ kind: 'muted', text: 'No local changes to save' });
  }
  const head = headCommit(repo, wt);
  const branch = wt.head.branch ?? DEFAULT_BRANCH;
  const next = structuredClone(repo);
  const nwt = activeWt(next);
  const seq = next.stashes.reduce((m, s) => Math.max(m, s.seq), 0) + 1;
  next.stashes.unshift({
    seq,
    worktreeId: wt.id,
    label: `WIP on ${branch}: ${hashOf(repo, headCommitId(repo, wt))} ${firstLine(head?.message ?? '')}`,
    files,
    indexFiles,
    baseCommitId: headCommitId(repo, wt)!,
  });
  applyTree(next, nwt, hTree, true); // 工作区/暂存区回到 HEAD，untracked 保留
  const count = Object.keys(files).length;
  return {
    repo: next,
    output: [
      { kind: 'success', text: `Saved working directory and index state WIP on ${branch}: ${hashOf(repo, headCommitId(repo, wt))}` },
      { kind: 'hint', text: `发生了什么：${count} 个文件的未提交改动被收进 stash（暂存区里的也一并收走），工作区恢复干净，可以随意切分支了` },
    ],
    ops: [{ type: 'STASH_CREATED', count }],
  };
}

// ---------- git worktree ----------

export function cmdWorktree(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const sub = positional(parsed)[0];

  if (sub === 'list') {
    const output: OutputLine[] = repo.worktrees.map((w) => {
      const mark = w.id === repo.activeWorktreeId ? '* ' : '  ';
      const cid = headCommitId(repo, w);
      const branch = w.head.branch ? ` [${w.head.branch}]` : ' [detached]';
      return { kind: w.id === repo.activeWorktreeId ? ('success' as const) : ('info' as const), text: `${mark}${w.id === 'wt-main' ? w.label : w.path}  ${hashOf(repo, cid)}${branch}` };
    });
    output.push({ kind: 'hint', text: '每个 worktree 有独立的工作区和暂存区，共享同一份提交历史' });
    return { repo: null, output, ops: [] };
  }

  if (sub === 'remove') {
    const key = positional(parsed)[1];
    const wt = repo.worktrees.find((w) => w.path === key || w.label === key || w.id === key);
    if (!wt) return fail({ kind: 'error', text: `fatal: '${key ?? ''}' does not match any worktree` });
    if (wt.id === 'wt-main') return fail({ kind: 'error', text: `fatal: '${key}' is a main working tree` });
    if (wt.id === repo.activeWorktreeId) {
      return fail({ kind: 'error', text: `fatal: 无法删除当前所在的 worktree，先切换回主目录再删除` });
    }
    const next = structuredClone(repo);
    next.worktrees = next.worktrees.filter((w) => w.id !== wt.id);
    return {
      repo: next,
      output: [
        { kind: 'success', text: `✓ 已删除 worktree ${wt.path}（Git 记录一并清除）` },
        { kind: 'hint', text: '注意：不能直接把文件夹拖进废纸篓——那会留下 Git 记录；其中的提交仍在共享历史里，不会丢' },
      ],
      ops: [{ type: 'WORKTREE_REMOVED', id: wt.id }],
    };
  }

  if (sub === 'add' || sub === undefined) {
    // -b 的值会落在位置参数里，先剔除，剩下的才是 [add?, path, base?]
    const bv = flagValue(parsed, '-b');
    const rest = positional(parsed).filter((t, i) => !(bv !== null && t === bv && i > 0));
    const path = rest[1];
    if (!path) return fail({ kind: 'error', text: 'usage: git worktree add <目录> -b <新分支> <基于分支>' });
    const baseToken = rest[2];
    const newBranch = flagValue(parsed, '-b');
    const wt = activeWt(repo);
    const base = resolveCommitish(repo, wt, baseToken) ?? headCommit(repo, wt);
    if (!base) return fail({ kind: 'error', text: 'fatal: 还没有任何提交，无法创建 worktree' });
    if (baseToken && !resolveCommitish(repo, wt, baseToken)) {
      return fail({ kind: 'error', text: `fatal: invalid reference: ${baseToken}` });
    }

    let branchName: string;
    const next = structuredClone(repo);
    if (newBranch) {
      if (next.branches[newBranch]) {
        return fail({ kind: 'error', text: `fatal: a branch named '${newBranch}' already exists` });
      }
      next.branches[newBranch] = { name: newBranch, commitId: base.id };
      branchName = newBranch;
    } else if (baseToken && next.branches[baseToken]) {
      branchName = baseToken;
    } else {
      return fail({ kind: 'error', text: 'usage: 需要用 -b 指定新分支，或给定一个已存在的分支名' });
    }
    if (next.worktrees.some((w) => w.head.branch === branchName)) {
      return fail({ kind: 'error', text: `fatal: '${branchName}' is already checked out at '${next.worktrees.find((w) => w.head.branch === branchName)!.label}'` });
    }
    if (next.worktrees.some((w) => w.path === path)) {
      return fail({ kind: 'error', text: `fatal: '${path}' already exists` });
    }
    const id = `wt-${next.clock + 1}-${next.worktrees.length}`;
    const label = path.split('/').pop() ?? path;
    next.worktrees.push({
      id,
      path,
      label,
      head: { kind: 'branch', branch: branchName },
      workingFiles: cloneTree(base.tree),
      index: cloneTree(base.tree),
      mergeState: null,
      rebaseState: null,
    });
    return {
      repo: next,
      output: [
        { kind: 'muted', text: `Preparing worktree (checking out '${branchName}')` },
        { kind: 'info', text: `HEAD is now at ${base.hash} ${firstLine(base.message)}` },
        { kind: 'hint', text: `发生了什么：多了一个目录（${label}），它有自己的工作区和暂存区，但和主目录共用同一份提交历史` },
        { kind: 'hint', text: '点击顶部的目录标签即可切换过去干活' },
      ],
      ops: [{ type: 'WORKTREE_ADDED', id }],
    };
  }

  return fail({ kind: 'error', text: `usage: git worktree add / list / remove <目录>` });
}

// ---------- git remote / push / pull / clone ----------

export function cmdRemote(repo: Repository, parsed: ParsedCommand): CommandResult {
  const sub = positional(parsed)[0];
  if (sub !== 'add') return fail({ kind: 'error', text: 'usage: git remote add origin <url>' });
  const name = positional(parsed)[1] ?? 'origin';
  const url = positional(parsed)[2];
  if (!url) return fail({ kind: 'error', text: 'usage: git remote add origin git@github.com:用户名/仓库.git' });
  if (repo.remote) return fail({ kind: 'error', text: `error: remote ${repo.remote.name} already exists.` });
  const next = structuredClone(repo);
  next.remote = { name, url, branches: {} };
  return {
    repo: next,
    output: [
      { kind: 'success', text: `✓ 已登记远程仓库 ${name} → ${url}` },
      { kind: 'hint', text: '远程需要验证身份：SSH Key 是一对文件——私钥留本地绝不外传，公钥交给 GitHub，推送时用它验证签名（右侧 Remote 面板有示意）' },
    ],
    ops: [{ type: 'REMOTE_ADDED' }],
  };
}

export function cmdPush(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  if (!repo.remote) {
    return fail(
      { kind: 'error', text: 'fatal: No configured push destination.' },
      { kind: 'hint', text: '提示：先 git remote add origin <url> 登记远程仓库（本实验室用模拟远程演示）' },
    );
  }
  const wt = activeWt(repo);
  const pos = positional(parsed); // [origin?, branch?] 或 [branch?]
  const branch = pos[0] === repo.remote.name ? pos[1] : pos[0];
  const b = branch ?? wt.head.branch;
  if (!b) return fail({ kind: 'error', text: 'fatal: 当前处于分离 HEAD，无法推送' });
  const localTip = repo.branches[b]?.commitId;
  if (!localTip) return fail({ kind: 'error', text: `error: src refspec ${b} does not match any` });
  const oldTip = repo.remote.branches[b] ?? null;
  if (oldTip === localTip) return fail({ kind: 'muted', text: 'Everything up-to-date' });

  const newSet = [...ancestors(repo, localTip)].filter((id) => !oldTip || !ancestors(repo, oldTip).has(id));
  const next = structuredClone(repo);
  next.remote!.branches[b] = localTip;
  return {
    repo: next,
    output: [
      { kind: 'muted', text: `Enumerating objects: ${newSet.length * 3}, done.` },
      { kind: 'muted', text: `Writing objects: 100% (${newSet.length * 3}/${newSet.length * 3}), done.` },
      { kind: 'success', text: `✓ 已把 ${newSet.length} 个提交推送到 ${repo.remote.name}/${b}（整个提交历史都会上传备份）` },
      ...(hasFlag(parsed, '-u') || hasFlag(parsed, '--set-upstream')
        ? [{ kind: 'hint' as const, text: `已绑定本地 ${b} ↔ ${repo.remote.name}/${b}，以后推送只需 git push` }]
        : []),
    ],
    ops: [{ type: 'PUSH_SYNCED', count: newSet.length }],
  };
}

export function cmdPull(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  if (!repo.remote) return fail({ kind: 'error', text: 'fatal: 没有配置远程仓库（git remote add origin <url>）' });
  const wt = activeWt(repo);
  const b = wt.head.branch;
  if (!b) return fail({ kind: 'error', text: 'fatal: 分离 HEAD 无法 pull' });
  const remoteId = repo.remote.branches[b];
  if (!remoteId) return fail({ kind: 'muted', text: 'Already up to date.（远程还没有这个分支）' });
  const localId = repo.branches[b]?.commitId;
  if (!localId || localId === remoteId) return fail({ kind: 'muted', text: 'Already up to date.' });
  // 本地已包含远程：无事可做
  if (ancestors(repo, localId).has(remoteId)) return fail({ kind: 'muted', text: 'Already up to date.' });

  // 远程领先：快进
  if (ancestors(repo, remoteId).has(localId)) {
    const next = structuredClone(repo);
    const nwt = activeWt(next);
    moveBranch(next, b, remoteId);
    applyTree(next, nwt, next.commits[remoteId].tree, true);
    const count = [...ancestors(repo, remoteId)].filter((id) => !ancestors(repo, localId).has(id)).length;
    return {
      repo: next,
      output: [{ kind: 'success', text: `Fast-forward：从 ${repo.remote!.name}/${b} 拉回 ${count} 个提交` }],
      ops: [{ type: 'PULL_SYNCED', count }],
    };
  }

  // 分叉：走三方合并（与本地 merge 相同的机制）
  const baseId = mergeBase(repo, localId, remoteId);
  if (!baseId) return fail({ kind: 'error', text: 'fatal: 找不到共同祖先（教学简化）' });
  const baseTree: Tree = repo.commits[baseId].tree;
  const oursTree = headTree(repo, wt);
  const theirsTree = repo.commits[remoteId].tree;
  const { merged, conflicts } = mergeTrees(baseTree, oursTree, theirsTree);
  const next = structuredClone(repo);
  const nwt = activeWt(next);
  if (Object.keys(conflicts).length === 0) {
    const commit = makeCommit(next, {
      message: `Merge branch '${b}' of ${repo.remote!.url}`,
      tree: merged,
      parents: [localId, remoteId],
      merge: true,
      branch: b,
    });
    moveBranch(next, b, commit.id);
    nwt.index = { ...merged };
    const count = [...ancestors(next, remoteId)].filter((id) => !ancestors(repo, localId).has(id)).length;
    return {
      repo: next,
      output: [{ kind: 'success', text: `Merge made by the 'ort' strategy.（拉回 ${count} 个提交并合并）` }],
      ops: [{ type: 'COMMIT_CREATED', commitId: commit.id }, { type: 'PULL_SYNCED', count }],
    };
  }
  nwt.mergeState = {
    theirsBranch: `${repo.remote!.name}/${b}`,
    theirsCommitId: remoteId,
    baseCommitId: baseId,
    conflicts: Object.fromEntries(Object.entries(conflicts).map(([p, c]) => [p, { ...c, path: p, resolved: false }])),
  };
  for (const [p, c] of Object.entries(conflicts)) {
    nwt.workingFiles[p] = conflictMarkers(c.ours, c.theirs, `${repo.remote!.name}/${b}`);
  }
  for (const [p, content] of Object.entries(merged)) {
    if (!conflicts[p] && !sameLines(content, oursTree[p])) nwt.index[p] = content;
  }
  return {
    repo: next,
    output: [
      { kind: 'error', text: `CONFLICT (content): Merge conflict in ${Object.keys(conflicts)[0]}` },
      { kind: 'error', text: 'Automatic merge failed; fix conflicts and then commit the result.' },
    ],
    ops: [{ type: 'CONFLICT_CREATED', paths: Object.keys(conflicts), theirsBranch: `${repo.remote!.name}/${b}` }],
  };
}

export function cmdClone(repo: Repository, parsed: ParsedCommand): CommandResult {
  const pos = positional(parsed);
  const dir = pos[1] ?? 'mark-todo';
  if (!repo.remote) {
    return fail(
      { kind: 'error', text: `fatal: repository '${pos[0] ?? ''}' not found` },
      { kind: 'hint', text: '提示：本实验室的远程由 git remote add origin 模拟；要演练"删库恢复"，先登记远程并 push 过' },
    );
  }
  const remoteTips = Object.values(repo.remote.branches);
  if (!remoteTips.length) return fail({ kind: 'error', text: 'fatal: 远程仓库是空的，先 git push' });
  const next = structuredClone(repo);
  const keep = new Set<string>();
  for (const t of remoteTips) for (const id of ancestors(repo, t)) keep.add(id);
  next.commits = Object.fromEntries(Object.entries(next.commits).filter(([id]) => keep.has(id)));
  next.branches = Object.fromEntries(
    Object.entries(repo.remote!.branches).map(([b, cid]) => [b, { name: b, commitId: cid }]),
  );
  const defaultBranch = next.branches[DEFAULT_BRANCH] ? DEFAULT_BRANCH : Object.keys(next.branches)[0];
  const nwt = next.worktrees[0];
  nwt.head = { kind: 'branch', branch: defaultBranch };
  const tip = next.commits[next.branches[defaultBranch].commitId!];
  nwt.workingFiles = cloneTree(tip.tree);
  nwt.index = cloneTree(tip.tree);
  nwt.mergeState = null;
  nwt.rebaseState = null;
  next.stashes = [];
  next.ghosts = [];
  next.activeWorktreeId = 'wt-main';
  return {
    repo: next,
    output: [
      { kind: 'muted', text: `Cloning into '${dir}'...` },
      { kind: 'muted', text: `remote: Enumerating objects: ${keep.size * 3}, done.` },
      { kind: 'muted', text: `Receiving objects: 100% (${keep.size * 3}/${keep.size * 3}), done.` },
      { kind: 'success', text: `✓ 已从远程恢复 ${keep.size} 个提交的完整历史与全部文件（本地删库也不怕了）` },
    ],
    ops: [{ type: 'CLONED' }],
  };
}
