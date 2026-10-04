import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GitCommitHorizontal } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { activeWt, visibleCommits } from '../git-engine/repository';
import type { Commit } from '../types';

const ROW_H = 52;
const LANE_W = 46;
const LEFT_W = 200;
const NODE_R = 8;
const PALETTE = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'];

interface Row {
  commit: Commit;
  lane: number;
  ghost: boolean;
}

function layoutRows(commits: Commit[], ghostIds: Set<string>): Row[] {
  const reserved = new Map<string, number>();
  const laneOf = new Map<string, number>();
  const lanes: (string | null)[] = [];
  const rows: Row[] = [];
  for (const c of commits) {
    let lane = reserved.get(c.id);
    if (lane === undefined) {
      lane = lanes.findIndex((v) => v === null);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(null);
      }
    }
    laneOf.set(c.id, lane);
    lanes[lane] = c.id;
    rows.push({ commit: c, lane, ghost: ghostIds.has(c.id) });
    c.parents.forEach((p, i) => {
      if (!laneOf.has(p) && !reserved.has(p)) {
        if (i === 0) {
          reserved.set(p, lane);
          lanes[lane] = p;
        } else {
          let l = lanes.findIndex((v) => v === null);
          if (l === -1) {
            l = lanes.length;
            lanes.push(null);
          }
          reserved.set(p, l);
          lanes[l] = p;
        }
      }
    });
  }
  return rows;
}

export function CommitGraph() {
  const repo = useLabStore((s) => s.repo);
  const wt = activeWt(repo);
  const ghostIds = useMemo(() => new Set(repo.ghosts.map((g) => g.id)), [repo]);
  const commits = useMemo(() => visibleCommits(repo), [repo]);
  const rows = useMemo(() => layoutRows(commits, ghostIds), [commits, ghostIds]);
  const rowMap = useMemo(() => new Map(rows.map((r) => [r.commit.id, r])), [rows]);

  const branchNames = useMemo(() => Object.keys(repo.branches).sort(), [repo.branches]);
  const branchColor = useMemo(() => {
    const m = new Map<string, string>();
    branchNames.forEach((n, i) => m.set(n, PALETTE[i % PALETTE.length]));
    return m;
  }, [branchNames]);

  const laneCount = rows.reduce((m, r) => Math.max(m, r.lane + 1), 1);
  const width = LEFT_W + laneCount * LANE_W + 330;
  const height = rows.length * ROW_H + 28;
  const x = (lane: number) => LEFT_W + lane * LANE_W;
  const y = (rowIdx: number) => rowIdx * ROW_H + ROW_H / 2 + 8;

  const chipWidth = (t: string) => t.length * 6.4 + 20;

  // 每个提交上要贴的标签（分支 + worktree HEAD 标注）
  const labels = useMemo(() => {
    const out: { commitId: string; text: string; color: string; head: boolean; wtLabel?: string; key: string }[] = [];
    for (const b of Object.values(repo.branches)) {
      if (!b.commitId) continue;
      const color = branchColor.get(b.name) ?? '#64748b';
      const headWts = repo.worktrees.filter((w) => w.head.branch === b.name);
      const isActive = wt.head.branch === b.name;
      out.push({
        commitId: b.commitId,
        text: isActive ? b.name : headWts.some((w) => w.id !== 'wt-main') ? `${b.name} @${headWts.find((w) => w.id !== 'wt-main')!.label}` : b.name,
        color,
        head: isActive,
        key: `b-${b.name}`,
      });
      // 活跃 worktree 的 HEAD 标签
      if (isActive) {
        out.push({ commitId: b.commitId, text: 'HEAD', color: '#0f172a', head: true, key: 'head-active' });
      }
    }
    // 分离 HEAD（clone 重建等场景）
    if (wt.head.kind === 'detached' && wt.head.commitId) {
      out.push({ commitId: wt.head.commitId, text: 'HEAD', color: '#0f172a', head: true, key: 'head-detached' });
    }
    return out;
  }, [repo, wt, branchColor]);

  const labelsByCommit = useMemo(() => {
    const m = new Map<string, typeof labels>();
    for (const l of labels) {
      if (!m.has(l.commitId)) m.set(l.commitId, []);
      m.get(l.commitId)!.push(l);
    }
    return m;
  }, [labels]);

  return (
    <div className="relative min-h-0 flex-1 overflow-auto bg-white">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white/90 px-4 py-1.5 backdrop-blur">
        <GitCommitHorizontal className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-700">Commit Graph</span>
        <span className="text-[10px] text-slate-400">圆点 = 提交 · 线 = 父子关系 · 虚影 = 被回退/重写的旧提交</span>
      </div>

      {!repo.initialized && (
        <div className="flex h-40 items-center justify-center text-xs text-slate-400">
          尚未初始化 —— 执行 <span className="mono mx-1 rounded bg-slate-100 px-1.5 py-0.5">git init</span> 后，这里会出现提交图
        </div>
      )}

      {repo.initialized && rows.length === 0 && (
        <div className="flex h-40 items-center justify-center text-xs text-slate-400">
          还没有任何提交 —— git add + git commit 之后，第一个提交会出现在这里
        </div>
      )}

      {repo.initialized && rows.length > 0 && (
        <svg width={width} height={height} className="block">
          {/* 连线（父关系） */}
          {rows.map((r, i) =>
            r.commit.parents.map((p) => {
              const pr = rowMap.get(p);
              if (!pr) return null;
              const x1 = x(r.lane);
              const y1 = y(i);
              const x2 = x(pr.lane);
              const y2 = y(rows.indexOf(pr));
              const d =
                r.lane === pr.lane
                  ? `M ${x1} ${y1} L ${x2} ${y2}`
                  : `M ${x1} ${y1} C ${x1} ${y1 + 22}, ${x2} ${y2 - 22}, ${x2} ${y2}`;
              return (
                <path
                  key={`e-${r.commit.id}-${p}`}
                  d={d}
                  fill="none"
                  stroke={r.ghost || pr.ghost ? '#cbd5e1' : PALETTE[r.lane % PALETTE.length]}
                  strokeWidth={r.ghost || pr.ghost ? 1.2 : 1.8}
                  strokeDasharray={r.ghost || pr.ghost ? '4 3' : undefined}
                  opacity={r.ghost || pr.ghost ? 0.55 : 0.9}
                />
              );
            }),
          )}

          {/* 节点 */}
          <AnimatePresence initial={false}>
            {rows.map((r, i) => {
              const color = PALETTE[r.lane % PALETTE.length];
              const msg = r.commit.message.split('\n')[0];
              return (
                <motion.g
                  key={r.commit.id}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: r.ghost ? 0.4 : 1, scale: 1, x: x(r.lane), y: y(i) }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  {r.commit.merge && <circle r={NODE_R + 3.5} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={1.5} />}
                  <circle r={NODE_R} fill={r.ghost ? '#e2e8f0' : color} stroke={r.ghost ? '#94a3b8' : '#fff'} strokeWidth={2} strokeDasharray={r.ghost ? '3 2' : undefined} />
                  {/* 分支/HEAD 标签 */}
                  {(labelsByCommit.get(r.commit.id) ?? []).map((l) => {
                    const isHeadChip = l.text === 'HEAD';
                    const w = chipWidth(l.text);
                    return (
                      <motion.g
                        key={l.key}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <rect
                          x={-14 - w}
                          y={-9}
                          width={w}
                          height={18}
                          rx={9}
                          fill={isHeadChip ? '#0f172a' : '#fff'}
                          stroke={isHeadChip ? '#0f172a' : l.color}
                          strokeWidth={1.4}
                        />
                        <text
                          x={-14 - w / 2}
                          y={3.5}
                          textAnchor="middle"
                          fontSize={10}
                          fontFamily="ui-monospace, monospace"
                          fill={isHeadChip ? '#fbbf24' : l.color}
                          fontWeight={isHeadChip ? 700 : 600}
                        >
                          {l.text}
                        </text>
                      </motion.g>
                    );
                  })}
                  <text x={16} y={4} fontSize={11} fontFamily="ui-monospace, monospace" fill={r.ghost ? '#94a3b8' : '#334155'}>
                    {r.commit.hash} {msg}
                    {r.commit.message.includes('\n') ? ' …' : ''}
                  </text>
                  {r.ghost && (
                    <text x={16} y={17} fontSize={9} fill="#94a3b8">
                      已被回退/重写（重写后以新提交出现）
                    </text>
                  )}
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>
      )}
    </div>
  );
}
