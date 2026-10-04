import type { Line, DiffRow } from '../types';

/** 确定性伪 hash：同一 commit 每次生成结果一致 */
export function fakeHash(seed: string, len = 7): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  let s = '';
  while (s.length < len) {
    h = (h * 1103515245 + 12345) >>> 0;
    s += h.toString(16).padStart(8, '0');
  }
  return s.slice(0, len);
}

export type { DiffRow };

/** 基于 LCS 的行 diff */
export function diffLines(a: Line[], b: Line[]): DiffRow[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'del', text: a[i] });
      i++;
    } else {
      rows.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: 'del', text: a[i++] });
  while (j < m) rows.push({ type: 'add', text: b[j++] });
  return rows;
}

/** 将行数组渲染为带 +/- 前缀的终端行 */
export function diffToOutput(rows: DiffRow[]): { kind: 'add' | 'del' | 'muted'; text: string }[] {
  const out: { kind: 'add' | 'del' | 'muted'; text: string }[] = [];
  for (const r of rows) {
    if (r.type === 'add') out.push({ kind: 'add', text: `+ ${r.text}` });
    else if (r.type === 'del') out.push({ kind: 'del', text: `- ${r.text}` });
    else out.push({ kind: 'muted', text: `  ${r.text}` });
  }
  return out;
}

export const CONFLICT_MARKERS = {
  start: '<<<<<<< HEAD',
  sep: '=======',
};

/** 生成带冲突标记的文件内容（用于展示与工作区写入） */
export function conflictMarkers(ours: Line[], theirs: Line[], theirsBranch: string): Line[] {
  return [
    CONFLICT_MARKERS.start,
    ...ours,
    CONFLICT_MARKERS.sep,
    ...theirs,
    `>>>>>>> ${theirsBranch}`,
  ];
}

export function hasConflictMarkers(lines: Line[]): boolean {
  return lines.some((l) => l.startsWith('<<<<<<< ') || l === CONFLICT_MARKERS.sep || l.startsWith('>>>>>>> '));
}
