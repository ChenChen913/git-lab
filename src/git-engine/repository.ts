import type { Commit, Line, Repository, Worktree } from '../types';

export const DEFAULT_BRANCH = 'master';
export const DEFAULT_AUTHOR = { userName: '马克', userEmail: 'mark@example.com' };

export function initialRepo(): Repository {
  const main: Worktree = {
    id: 'wt-main',
    path: '.',
    label: 'mark-todo',
    head: { kind: 'branch' },
    workingFiles: {},
    index: {},
    mergeState: null,
    rebaseState: null,
  };
  return {
    initialized: false,
    clock: 0,
    commits: {},
    branches: {},
    worktrees: [main],
    activeWorktreeId: 'wt-main',
    stashes: [],
    remote: null,
    ghosts: [],
    config: { ...DEFAULT_AUTHOR },
  };
}

export function activeWt(repo: Repository): Worktree {
  return repo.worktrees.find((w) => w.id === repo.activeWorktreeId) ?? repo.worktrees[0];
}

export function headCommit(repo: Repository, wt: Worktree): Commit | null {
  const id =
    wt.head.kind === 'branch' ? repo.branches[wt.head.branch!]?.commitId : wt.head.commitId;
  return id ? (repo.commits[id] ?? null) : null;
}

export function headCommitId(repo: Repository, wt: Worktree): string | null {
  return headCommit(repo, wt)?.id ?? null;
}

export function headTree(repo: Repository, wt: Worktree): Record<string, Line[]> {
  const c = headCommit(repo, wt);
  return c ? c.tree : {};
}

/** 解析 commit-ish：HEAD / HEAD~n / 分支名 / hash 前缀；失败返回 null */
export function resolveCommitish(repo: Repository, wt: Worktree, token?: string): Commit | null {
  if (!token || token === 'HEAD') return headCommit(repo, wt);
  const m = token.match(/^HEAD~(\d+)$/);
  if (m) {
    let c = headCommit(repo, wt);
    for (let i = 0; i < Number(m[1]) && c; i++) c = repo.commits[c.parents[0]] ?? null;
    return c;
  }
  if (repo.branches[token]) {
    const cid = repo.branches[token].commitId;
    return cid ? (repo.commits[cid] ?? null) : null;
  }
  return Object.values(repo.commits).find((c) => c.hash.startsWith(token)) ?? null;
}

export function authorName(repo: Repository): string {
  return repo.config.userName || DEFAULT_AUTHOR.userName;
}

export function authorLine(repo: Repository): string {
  return `${authorName(repo)} <${repo.config.userEmail || DEFAULT_AUTHOR.userEmail}>`;
}

// ---------- 状态推导 ----------

export type FileStatus = 'untracked' | 'modified' | 'staged' | 'staged+modified' | 'clean';

export interface FileStatusInfo {
  path: string;
  status: FileStatus;
  ignored: boolean;
}

/** 解析工作区 .gitignore（逐行精确路径或 * 通配） */
export function ignoredPaths(wt: Worktree): string[] {
  const gitignore = wt.workingFiles['.gitignore'];
  if (!gitignore) return [];
  return gitignore
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .flatMap((p) => {
      if (p.includes('*')) {
        const prefix = p.slice(0, p.indexOf('*'));
        return Object.keys(wt.workingFiles).filter(
          (f) => f.startsWith(prefix) && f !== '.gitignore',
        );
      }
      return [p];
    });
}

export function isIgnored(wt: Worktree, path: string): boolean {
  return path !== '.gitignore' && ignoredPaths(wt).includes(path);
}

function sameLines(a?: Line[], b?: Line[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((l, i) => l === b[i]);
}

/** 计算工作区所有文件的状态（含被忽略文件） */
export function fileStatuses(repo: Repository, wt: Worktree): FileStatusInfo[] {
  const hTree = headTree(repo, wt);
  const paths = new Set([
    ...Object.keys(wt.workingFiles),
    ...Object.keys(wt.index),
    ...Object.keys(hTree),
  ]);
  const list: FileStatusInfo[] = [];
  for (const path of paths) {
    const inH = path in hTree;
    const inIdx = path in wt.index;
    const inWork = path in wt.workingFiles;
    let status: FileStatus;
    if (!inH && !inIdx && inWork) status = 'untracked';
    else if (inIdx && !sameLines(wt.index[path], inH ? hTree[path] : undefined)) {
      status =
        inWork && !sameLines(wt.workingFiles[path], wt.index[path])
          ? 'staged+modified'
          : 'staged';
    } else if (
      inWork &&
      !sameLines(wt.workingFiles[path], inH ? hTree[path] : inIdx ? wt.index[path] : undefined)
    ) {
      status = 'modified';
    } else status = 'clean';
    list.push({ path, status, ignored: isIgnored(wt, path) });
  }
  return list.sort((a, b) => a.path.localeCompare(b.path));
}

/** 未提交改动路径（工作区或暂存区与 HEAD 不同；不含被忽略文件） */
export function dirtyPaths(repo: Repository, wt: Worktree): string[] {
  return fileStatuses(repo, wt)
    .filter((f) => f.status !== 'clean' && !f.ignored)
    .map((f) => f.path);
}

export function cloneTree(t: Record<string, Line[]>): Record<string, Line[]> {
  const out: Record<string, Line[]> = {};
  for (const [k, v] of Object.entries(t)) out[k] = [...v];
  return out;
}

/**
 * 把工作区/暂存区设置为某个 tree（保留 untracked 文件）。
 * untracked 判定依据：当前不在 index 中的工作区文件。
 * （本模型中已跟踪文件始终存在于 index —— commit/checkout 时 index 与 tree 对齐）
 */
export function applyTree(
  repo: Repository,
  wt: Worktree,
  tree: Record<string, Line[]>,
  keepUntracked = true,
) {
  const untracked: Record<string, Line[]> = {};
  if (keepUntracked) {
    for (const [p, c] of Object.entries(wt.workingFiles)) {
      if (!(p in wt.index)) untracked[p] = c;
    }
  }
  wt.workingFiles = { ...cloneTree(tree), ...untracked };
  wt.index = cloneTree(tree);
}

// ---------- 历史遍历 ----------

export function ancestors(repo: Repository, commitId: string | null): Set<string> {
  const seen = new Set<string>();
  const stack = commitId ? [commitId] : [];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const c = repo.commits[id];
    if (c) stack.push(...c.parents);
  }
  return seen;
}

/** 最近公共祖先（BFS，按 parent 顺序） */
export function mergeBase(repo: Repository, a: string, b: string): string | null {
  const ancA = ancestors(repo, a);
  const queue = [b];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (ancA.has(id)) return id;
    if (seen.has(id)) continue;
    seen.add(id);
    const c = repo.commits[id];
    if (c) queue.push(...c.parents);
  }
  return null;
}

/** 从所有分支 tips + ghosts 出发的全部可见 commit，按创建时间倒序 */
export function visibleCommits(repo: Repository): Commit[] {
  const set = new Set<string>();
  const tips = Object.values(repo.branches)
    .map((b) => b.commitId)
    .filter(Boolean) as string[];
  for (const t of [...tips, ...repo.ghosts.map((g) => g.id)]) {
    if (repo.commits[t]) for (const id of ancestors(repo, t)) set.add(id);
  }
  for (const g of repo.ghosts) set.add(g.id);
  return [...set]
    .map((id) => repo.commits[id])
    .filter(Boolean)
    .sort((a, b) => b.order - a.order);
}

/** 本地领先/落后远程的提交数 */
export function aheadBehind(repo: Repository, branch: string): { ahead: number; behind: number } | null {
  if (!repo.remote) return null;
  const remoteId = repo.remote.branches[branch];
  const localId = repo.branches[branch]?.commitId;
  if (!remoteId || !localId) return null;
  const localSet = ancestors(repo, localId);
  const remoteSet = ancestors(repo, remoteId);
  let ahead = 0;
  for (const id of localSet) if (!remoteSet.has(id)) ahead++;
  let behind = 0;
  for (const id of remoteSet) if (!localSet.has(id)) behind++;
  return { ahead, behind };
}

/** status 三分组（教学对齐教程提示语） */
export function statusGroups(repo: Repository, wt: Worktree) {
  const files = fileStatuses(repo, wt).filter((f) => !f.ignored);
  return {
    staged: files.filter((f) => f.status === 'staged' || f.status === 'staged+modified'),
    unstaged: files.filter((f) => f.status === 'modified' || f.status === 'staged+modified'),
    untracked: files.filter((f) => f.status === 'untracked'),
  };
}
