import type { CommandResult, OutputLine, ParsedCommand, Repository } from '../../types';
import {
  activeWt,
  ancestors,
  applyTree,
  headCommitId,
  headTree,
  resolveCommitish,
  dirtyPaths,
  cloneTree,
} from '../repository';
import { conflictMarkers, hasConflictMarkers } from '../text';
import {
  fail,
  firstLine,
  hasFlag,
  makeCommit,
  mergeTrees,
  moveBranch,
  notARepo,
  positional,
  type Tree,
} from './util';
import { sameLines } from './basic';

// ---------- git restore / git restore --staged ----------

export function cmdRestore(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const staged = hasFlag(parsed, '--staged');
  const pos = positional(parsed);
  if (!pos.length) {
    return fail({ kind: 'error', text: `usage: git restore${staged ? ' --staged' : ''} <文件名> 或 .` });
  }
  const hTree = headTree(repo, wt);
  const all = pos.includes('.');
  const next = structuredClone(repo);
  const nwt = activeWt(next);
  const paths: string[] = [];

  if (staged) {
    const candidates = all
      ? Object.keys(nwt.index).filter((p) => !sameLines(nwt.index[p], hTree[p]))
      : pos;
    for (const p of candidates) {
      if (!(p in nwt.index) && !(p in hTree)) {
        return fail({ kind: 'error', text: `error: pathspec '${p}' did not match any file(s) known to git` });
      }
    }
    for (const p of candidates) {
      if (p in hTree) nwt.index[p] = [...hTree[p]];
      else delete nwt.index[p];
      paths.push(p);
    }
    if (!paths.length) return fail({ kind: 'muted', text: '（暂存区与最新提交一致，无需撤销）' });
    return {
      repo: next,
      output: [
        ...paths.map((p) => ({ kind: 'success' as const, text: `✓ 已把 ${p} 从暂存区撤下` })),
        { kind: 'hint', text: '注意：这一步只改了 Git 的记录，文件内容还是修改后的样子；要彻底恢复执行 git restore .' },
      ],
      ops: [{ type: 'FILE_UNSTAGED', paths }],
    };
  }

  const candidates = all ? dirtyPaths(repo, wt).filter((p) => p in hTree) : pos;
  for (const p of candidates) {
    if (!(p in hTree)) {
      return fail({ kind: 'error', text: `error: pathspec '${p}' did not match any file(s) known to git` });
    }
  }
  for (const p of candidates) {
    nwt.workingFiles[p] = [...hTree[p]];
    paths.push(p);
  }
  if (!paths.length) return fail({ kind: 'muted', text: '（工作区没有需要撤销的改动）' });
  return {
    repo: next,
    output: [
      ...paths.map((p) => ({ kind: 'success' as const, text: `✓ 已撤销 ${p} 在工作区的改动` })),
      { kind: 'hint', text: '发生了什么：文件内容被恢复成最新提交时的样子，改动彻底消失' },
    ],
    ops: [{ type: 'FILE_RESTORED', paths }],
  };
}

// ---------- git reset [--hard|--mixed|--soft] <commit-ish> ----------

export function cmdReset(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const mode = hasFlag(parsed, '--hard') ? 'hard' : hasFlag(parsed, '--soft') ? 'soft' : 'mixed';
  const token = positional(parsed)[0];
  const target = resolveCommitish(repo, wt, token);
  if (!target) {
    return fail(
      { kind: 'error', text: `fatal: ambiguous argument '${token ?? 'HEAD'}': unknown revision or path not in the working tree.` },
      { kind: 'hint', text: '提示：可用 HEAD~1（上一个提交）、HEAD~2、分支名或提交号前缀' },
    );
  }
  const branch = wt.head.branch;
  if (!branch) return fail({ kind: 'error', text: 'fatal: 分离 HEAD 状态不支持 reset（教学简化）' });
  const oldTip = headCommitId(repo, wt);
  if (!oldTip) return fail({ kind: 'muted', text: '（还没有任何提交，无从回退）' });
  if (oldTip === target.id && mode !== 'hard') {
    return fail({ kind: 'muted', text: `（HEAD 已经在 ${target.hash} 上，无变化）` });
  }

  const next = structuredClone(repo);
  const nwt = activeWt(next);
  moveBranch(next, branch, target.id);

  // 被挤出去的 commit 变成幽灵节点，供动画展示"旧提交去了哪里"
  const oldAnc = ancestors(next, oldTip);
  const newAnc = ancestors(next, target.id);
  const removed = [...oldAnc].filter((id) => !newAnc.has(id)).sort((a, b) => next.commits[b].order - next.commits[a].order);
  next.ghosts = removed.map((id) => next.commits[id]).filter(Boolean);

  const output: OutputLine[] = [];
  if (mode === 'hard') {
    applyTree(next, nwt, target.tree, true);
    nwt.mergeState = null;
    nwt.rebaseState = null;
    output.push({ kind: 'success', text: `HEAD is now at ${target.hash} ${firstLine(target.message)}` });
    output.push({ kind: 'hint', text: '--hard：提交历史、暂存区、工作区三个区域全部回退，未提交的改动也一起消失（被挤出的提交以虚影显示）' });
  } else if (mode === 'mixed') {
    nwt.index = cloneTree(target.tree);
    output.push({ kind: 'success', text: `HEAD is now at ${target.hash} ${firstLine(target.message)}` });
    output.push({ kind: 'hint', text: '--mixed（默认）：提交历史与暂存区回退，改动保留在工作区——适合"提交完发现要改改再重新提交"' });
  } else {
    output.push({ kind: 'success', text: `HEAD is now at ${target.hash} ${firstLine(target.message)}` });
    output.push({ kind: 'hint', text: '--soft：只回退提交历史，暂存区与工作区原样保留——改完直接重新 commit' });
  }
  return {
    repo: next,
    output,
    ops: [{ type: 'BRANCH_MOVED', name: branch, toCommitId: target.id, mode: 'reset' }],
  };
}

// ---------- git revert <commit-ish> ----------

export function cmdRevert(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);
  const target = resolveCommitish(repo, wt, positional(parsed)[0]);
  if (!target) {
    return fail({ kind: 'error', text: `fatal: bad revision '${positional(parsed)[0] ?? 'HEAD'}'` });
  }
  if (target.parents.length !== 1) {
    return fail({ kind: 'error', text: 'error: revert 不支持合并提交（教学简化，请选择普通提交）' });
  }
  if (dirtyPaths(repo, wt).length) {
    return fail(
      { kind: 'error', text: 'error: your local changes would be overwritten by revert.' },
      { kind: 'hint', text: '提示：先提交或撤销手头的改动，再执行 revert' },
    );
  }
  const branch = wt.head.branch!;
  const headId = headCommitId(repo, wt)!;
  const parentTree: Tree = repo.commits[target.parents[0]].tree;
  const message = `Revert "${firstLine(target.message)}"\n\nThis reverts commit ${target.hash}.`;
  const next = structuredClone(repo);
  const nwt = activeWt(next);
  const commit = makeCommit(next, { message, tree: cloneTree(parentTree), parents: [headId] });
  moveBranch(next, branch, commit.id);
  nwt.index = cloneTree(parentTree);
  return {
    repo: next,
    output: [
      { kind: 'success', text: `[${branch} ${commit.hash}] Revert "${firstLine(target.message)}"` },
      { kind: 'hint', text: '发生了什么：没有删除任何提交，而是新增了一个"正好相反"的提交把改动抵消——原提交仍留在历史里，随时能找回' },
    ],
    ops: [{ type: 'COMMIT_CREATED', commitId: commit.id }, { type: 'REVERT_HIGHLIGHT', commitId: target.id }],
  };
}

// ---------- git rebase ----------

function hashOfId(repo: Repository, id: string | null): string {
  return id ? repo.commits[id]?.hash ?? '' : '';
}

export function cmdRebase(repo: Repository, parsed: ParsedCommand): CommandResult {
  if (!repo.initialized) return notARepo();
  const wt = activeWt(repo);

  if (hasFlag(parsed, '--abort')) {
    const st = wt.rebaseState;
    if (!st) return fail({ kind: 'error', text: 'fatal: no rebase in progress' });
    const next = structuredClone(repo);
    const nwt = activeWt(next);
    moveBranch(next, st.originalBranch, st.originalTipId);
    applyTree(next, nwt, next.commits[st.originalTipId].tree, false);
    nwt.rebaseState = null;
    next.ghosts = [];
    return {
      repo: next,
      output: [{ kind: 'success', text: `已放弃变基（rebase --abort），${st.originalBranch} 回到原来的位置` }],
      ops: [],
    };
  }

  if (hasFlag(parsed, '--continue')) {
    const st = wt.rebaseState;
    if (!st) return fail({ kind: 'error', text: 'fatal: no rebase in progress' });
    if (Object.keys(st.conflicts).length) {
      const unresolved = Object.values(st.conflicts).filter((c) => {
        const staged = wt.index[c.path];
        return !staged || hasConflictMarkers(staged);
      });
      if (unresolved.length) {
        return fail(
          { kind: 'error', text: 'error: 还有未解决的冲突' },
          ...unresolved.map((c) => ({ kind: 'error' as const, text: `\t${c.path}` })),
          { kind: 'hint', text: '提示：在冲突面板解决 → git add . → 再执行 git rebase --continue' },
        );
      }
      // 用户已解决并 git add：把解决结果作为重放内容
      const overlay: Record<string, string[]> = {};
      for (const p of Object.keys(st.conflicts)) overlay[p] = [...(wt.index[p] ?? [])];
      const next = structuredClone(repo);
      const nwt = activeWt(next);
      nwt.rebaseState!.conflicts = {};
      const acc = { output: [] as OutputLine[], ops: [] as CommandResult['ops'] };
      replayPending(next, nwt, acc, overlay);
      return { repo: next, output: acc.output, ops: acc.ops };
    }
    const next = structuredClone(repo);
    const nwt = activeWt(next);
    const acc = { output: [] as OutputLine[], ops: [] as CommandResult['ops'] };
    replayPending(next, nwt, acc);
    return { repo: next, output: acc.output, ops: acc.ops };
  }

  const name = positional(parsed)[0];
  if (!name) return fail({ kind: 'error', text: 'usage: git rebase <分支名>；进行中：--continue / --abort' });
  if (wt.mergeState) return fail({ kind: 'error', text: 'error: 先完成或放弃当前合并（commit 或 --abort）' });
  if (wt.rebaseState) return fail({ kind: 'error', text: 'error: 变基已在进行中' });
  const onto = repo.branches[name];
  if (!onto || !onto.commitId) {
    return fail({ kind: 'error', text: `fatal: invalid upstream '${name}'` });
  }
  const branch = wt.head.branch!;
  const oursTip = headCommitId(repo, wt);
  if (!oursTip) return fail({ kind: 'muted', text: '（当前分支还没有提交，无需变基）' });
  const ontoTip = onto.commitId;

  if (ancestors(repo, oursTip).has(ontoTip)) {
    return fail({ kind: 'muted', text: `Current branch ${branch} is up to date.` });
  }
  if (ancestors(repo, ontoTip).has(oursTip)) {
    const next = structuredClone(repo);
    const nwt = activeWt(next);
    moveBranch(next, branch, ontoTip);
    applyTree(next, nwt, next.commits[ontoTip].tree, true);
    return {
      repo: next,
      output: [{ kind: 'success', text: `Fast-forwarded ${branch} to ${name}.` }],
      ops: [{ type: 'BRANCH_MOVED', name: branch, toCommitId: ontoTip, mode: 'ff' }],
    };
  }

  // 收集当前分支独有、需要重放的提交（旧 → 新）
  const oursAnc = ancestors(repo, oursTip);
  const ontoAnc = ancestors(repo, ontoTip);
  const pending = [...oursAnc]
    .filter((id) => !ontoAnc.has(id))
    .map((id) => repo.commits[id])
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ id: c.id, message: c.message, author: c.author, tree: c.tree }));

  const next = structuredClone(repo);
  const nwt = activeWt(next);
  nwt.rebaseState = {
    originalBranch: branch,
    originalTipId: oursTip,
    ontoBranch: name,
    replayBaseId: ontoTip,
    pending,
    conflicts: {},
  };
  const acc = { output: [{ kind: 'muted' as const, text: `First, rewinding head to replay your work on top of it...` }], ops: [] as CommandResult['ops'] };
  replayPending(next, nwt, acc);
  return { repo: next, output: acc.output, ops: acc.ops };
}

/** 把 pending 里的提交逐个重放到 replayBaseId 上，遇冲突停下；overlay 为用户解决后的冲突文件内容 */
function replayPending(
  next: Repository,
  wt: ReturnType<typeof activeWt>,
  acc: { output: OutputLine[]; ops: CommandResult['ops'] },
  overlay?: Record<string, string[]>,
) {
  const st = wt.rebaseState!;
  while (st.pending.length) {
    const orig = st.pending[0];
    const baseId = next.commits[orig.id].parents[0] ?? null;
    const baseTree: Tree = baseId ? next.commits[baseId].tree : {};
    const oursTree = next.commits[st.replayBaseId].tree;
    let merged: Tree;
    let conflicts: Record<string, { ours: string[]; theirs: string[]; base: string[] }>;
    if (overlay) {
      // 继续重放被冲突打断的提交：非冲突部分照常合并，冲突路径用解决结果
      const m = mergeTrees(baseTree, oursTree, orig.tree);
      merged = { ...m.merged, ...overlay };
      conflicts = {};
    } else {
      ({ merged, conflicts } = mergeTrees(baseTree, oursTree, orig.tree));
    }

    if (Object.keys(conflicts).length) {
      st.conflicts = Object.fromEntries(
        Object.entries(conflicts).map(([p, c]) => [p, { ...c, path: p, resolved: false }]),
      );
      // 工作区/暂存区对齐新地基 + 已自动合并的部分 + 冲突标记
      const work: Tree = { ...cloneTree(oursTree) };
      for (const [p, content] of Object.entries(merged)) {
        if (!conflicts[p]) {
          work[p] = content;
          wt.index[p] = content;
        }
      }
      for (const [p, c] of Object.entries(conflicts)) {
        work[p] = conflictMarkers(c.ours, c.theirs, st.ontoBranch);
      }
      wt.workingFiles = { ...wt.workingFiles, ...work };
      acc.output.push({ kind: 'error', text: `error: could not apply ${next.commits[orig.id].hash}... ${firstLine(orig.message)}` });
      for (const p of Object.keys(conflicts)) {
        acc.output.push({ kind: 'error', text: `CONFLICT (content): Merge conflict in ${p}` });
      }
      acc.output.push({ kind: 'hint', text: '为什么会冲突：把这个提交重放到新地基上时，与新地基上的改动撞在了同一个位置' });
      acc.output.push({ kind: 'hint', text: '下一步：解决冲突 → git add . → git rebase --continue（注意：不是 git commit）' });
      acc.ops.push({ type: 'CONFLICT_CREATED', paths: Object.keys(conflicts), theirsBranch: st.ontoBranch });
      return;
    }

    // 无冲突：立即生成重放提交
    st.pending.shift();
    const commit = makeCommit(next, {
      message: orig.message,
      tree: merged,
      parents: [st.replayBaseId],
    });
    next.ghosts.push(next.commits[orig.id]);
    st.replayBaseId = commit.id;
    acc.output.push({ kind: 'info', text: `Applied: ${firstLine(orig.message)}（${next.commits[orig.id].hash} → ${commit.hash}）` });
    acc.ops.push({ type: 'COMMIT_REPLAYED', fromId: orig.id, toId: commit.id });
  }

  const branch = st.originalBranch;
  moveBranch(next, branch, st.replayBaseId);
  applyTree(next, wt, next.commits[st.replayBaseId].tree, true);
  wt.rebaseState = null;
  acc.output.push({ kind: 'success', text: `Successfully rebased and updated refs/heads/${branch}.` });
  acc.output.push({ kind: 'hint', text: '发生了什么：分支的每个提交被逐一"重放"到新地基上，旧提交被新提交替换（虚影显示）——这就是换地基' });
  acc.output.push({ kind: 'hint', text: `现在 ${branch} 已紧跟 ${st.ontoBranch} 最新提交，合并回去将是一次 Fast-forward` });
  acc.ops.push({ type: 'BRANCH_MOVED', name: branch, toCommitId: st.replayBaseId, mode: 'ff' });
}
