import type { CommandResult, Line, OutputLine, ParsedCommand, Repository, Commit } from '../../types';
import { diffLines } from '../text';
import { authorLine, DEFAULT_BRANCH } from '../repository';

export type Tree = Record<string, Line[]>;

export const fail = (...lines: OutputLine[]): CommandResult => ({ repo: null, output: lines, ops: [] });

export const positional = (p: ParsedCommand): string[] =>
  p.tokens.filter((t) => !t.flag).map((t) => t.text);

export const flagsOf = (p: ParsedCommand): string[] =>
  p.tokens.filter((t) => t.flag).map((t) => t.text);

export function hasFlag(p: ParsedCommand, ...names: string[]): boolean {
  return p.tokens.some((t) => t.flag && names.includes(t.text));
}

/** 取某个 flag 的值（其后紧邻的非 flag token），如 -m "msg"、-b feature/x */
export function flagValue(p: ParsedCommand, name: string): string | null {
  const i = p.tokens.findIndex((t) => t.flag && t.text === name);
  if (i < 0) return null;
  const nxt = p.tokens[i + 1];
  return nxt && !nxt.flag ? nxt.text : null;
}

export function firstLine(msg: string): string {
  return msg.split('\n')[0];
}

export function notARepo(): CommandResult {
  return fail({ kind: 'error', text: 'fatal: not a git repository (or any of the parent directories): .git' }, { kind: 'hint', text: '提示：先执行 git init 初始化仓库' });
}

/** 统计两个快照间的变化摘要（对齐真实 git 的 diffstat 风格） */
export function fileSummary(before: Tree, after: Tree): string {
  let files = 0;
  let add = 0;
  let del = 0;
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const p of paths) {
    const rows = diffLines(before[p] ?? [], after[p] ?? []);
    if (rows.some((r) => r.type !== 'same')) {
      files++;
      add += rows.filter((r) => r.type === 'add').length;
      del += rows.filter((r) => r.type === 'del').length;
    }
  }
  if (files === 0) return ' 0 files changed';
  const parts = [` ${files} file${files > 1 ? 's' : ''} changed`];
  if (add) parts.push(`${add} insertion${add > 1 ? 's' : ''}(+)`);
  if (del) parts.push(`${del} deletion${del > 1 ? 's' : ''}(-)`);
  return parts.join(', ');
}

/** 在 next 仓库上创建一个 commit（clock 自增）；branch = 创建时所在分支（颜色溯源用） */
export function makeCommit(
  next: Repository,
  opts: { message: string; tree: Tree; parents: string[]; merge?: boolean; branch?: string },
): Commit {
  next.clock += 1;
  const id = `c${next.clock}`;
  const commit: Commit = {
    id,
    hash: '',
    message: opts.message,
    author: authorLine(next),
    parents: opts.parents,
    tree: opts.tree,
    merge: !!opts.merge,
    order: next.clock,
    branch: opts.branch,
  };
  commit.hash = fakeHashFor(commit.id + commit.message);
  next.commits[id] = commit;
  return commit;
}

function fakeHashFor(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  let s = '';
  while (s.length < 7) {
    h = (h * 1103515245 + 12345) >>> 0;
    s += h.toString(16).padStart(8, '0');
  }
  return s.slice(0, 7);
}

export function moveBranch(next: Repository, branch: string, commitId: string) {
  next.branches[branch].commitId = commitId;
}

/** 合并/变基通用的三方文件级比较 */
export function mergeTrees(
  base: Tree,
  ours: Tree,
  theirs: Tree,
): { merged: Tree; conflicts: Record<string, { ours: Line[]; theirs: Line[]; base: Line[] }> } {
  const merged: Tree = {};
  const conflicts: Record<string, { ours: Line[]; theirs: Line[]; base: Line[] }> = {};
  const paths = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
  const eq = (a?: Line[], b?: Line[]) =>
    a === b || (!!a && !!b && a.length === b.length && a.every((l, i) => l === b[i]));
  for (const p of paths) {
    const b = base[p];
    const o = ours[p];
    const t = theirs[p];
    if (eq(o, t)) {
      if (o) merged[p] = o;
    } else if (eq(o, b)) {
      if (t) merged[p] = t;
    } else if (eq(t, b)) {
      if (o) merged[p] = o;
    } else {
      conflicts[p] = { ours: o ?? [], theirs: t ?? [], base: b ?? [] };
    }
  }
  return { merged, conflicts };
}

export function currentBranchName(next: Repository, wt: { head: { kind: string; branch?: string } }): string {
  return wt.head.branch ?? DEFAULT_BRANCH;
}
