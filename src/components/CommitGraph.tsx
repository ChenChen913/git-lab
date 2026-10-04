import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Waypoints } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { activeWt, visibleCommits } from '../git-engine/repository';
import type { Commit } from '../types';

const X_GAP = 86; // 水平时间轴间距
const PAD_X = 46;
const BASE_Y = 64; // 主干（master）水平线
const LANE_GAP = 88; // 分支行距（feature 在主干下方）
const NODE_R = 10;

// 语义：实心圆点 = 一个 commit；圆点颜色 = 所属分支的颜色
const LANE_COLORS = ['var(--color-cream)', 'var(--color-orange)', 'var(--color-blue)', 'var(--color-yellow)'];
const MAIN_EDGE = 'rgba(240,238,231,0.85)';
const GHOST_FILL = 'var(--color-ghost)';
const GHOST_EDGE = 'rgba(240,238,231,0.35)';

interface Row {
  commit: Commit;
  lane: number;
  ghost: boolean;
}

/**
 * 车道分配（水平时间线）：
 * lane 0 = 主干（master 的第一父链，恒为水平直线）；
 * 其余提交（feature 分支、幽灵链）各自占一条下方车道，子节点预留父节点车道。
 */
function layoutRows(
  repo: ReturnType<typeof useLabStore.getState>['repo'],
  commits: Commit[],
  ghostIds: Set<string>,
): Row[] {
  const laneOf = new Map<string, number>();
  const primaryTip = repo.branches['master']?.commitId ?? Object.values(repo.branches)[0]?.commitId ?? null;
  const mainSet = new Set<string>();
  let cur = primaryTip ? repo.commits[primaryTip] : null;
  while (cur) {
    mainSet.add(cur.id);
    laneOf.set(cur.id, 0);
    cur = cur.parents[0] ? repo.commits[cur.parents[0]] : null;
  }

  const reserved = new Map<string, number>();
  const used = new Set<number>([0]);
  let nextLane = 1;
  const rest = commits.filter((c) => !laneOf.has(c.id)).sort((a, b) => b.order - a.order);
  for (const c of rest) {
    if (laneOf.has(c.id)) continue;
    let lane = reserved.get(c.id);
    if (lane === undefined) {
      lane = nextLane++;
      used.add(lane);
    }
    laneOf.set(c.id, lane);
    const p = c.parents[0];
    if (p && repo.commits[p] && !laneOf.has(p) && !mainSet.has(p) && !reserved.has(p)) {
      reserved.set(p, lane);
    }
  }

  return commits
    .map((c) => ({
      commit: c,
      lane: laneOf.get(c.id) ?? 0,
      ghost: ghostIds.has(c.id),
    }))
    .sort((a, b) => a.commit.order - b.commit.order);
}

/** 分支气泡：圆角矩形 + 底部小三角指针 */
function BranchBubble({
  text,
  bg,
  above,
  second = false,
}: {
  text: string;
  bg: string;
  above: boolean;
  second?: boolean;
}) {
  const w = text.length * 7.6 + 18;
  const H = 26;
  const lift = second ? 34 : 0;
  const rectY = above ? -(NODE_R + 8 + H + lift) : NODE_R + 8 + lift;
  const triY = above ? -(NODE_R + 8 + lift) : NODE_R + 8 + lift;
  const cy = rectY + H / 2;
  return (
    <g>
      <rect x={-w / 2} y={rectY} width={w} height={H} rx={10} fill={bg} style={{ filter: 'var(--shadow-flat)' }} />
      <polygon
        points={`${-6},${above ? triY + H : triY} ${6},${above ? triY + H : triY} 0,${above ? triY + H + 6 : triY - 6}`}
        fill={bg}
      />
      <text x={0} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={12} className="mono" fill="var(--color-ink)">
        {text}
      </text>
    </g>
  );
}

export function CommitGraph() {
  const repo = useLabStore((s) => s.repo);
  const wt = activeWt(repo);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ghostIds = useMemo(() => new Set(repo.ghosts.map((g) => g.id)), [repo]);
  const commits = useMemo(() => visibleCommits(repo), [repo]);
  const rowsAsc = useMemo(() => layoutRows(repo, commits, ghostIds), [repo, commits, ghostIds]);
  const rowMap = useMemo(() => new Map(rowsAsc.map((r) => [r.commit.id, r])), [rowsAsc]);

  const laneCount = rowsAsc.reduce((m, r) => Math.max(m, r.lane + 1), 1);
  const width = PAD_X * 2 + Math.max(0, rowsAsc.length - 1) * X_GAP;
  const height = BASE_Y + (laneCount - 1) * LANE_GAP + 130;
  const x = (i: number) => PAD_X + i * X_GAP;
  const y = (lane: number) => BASE_Y + lane * LANE_GAP;

  // 分支稳定色：按分支创建顺序分配（master/main 用薄荷绿标签），全程不变
  const branchNames = useMemo(() => Object.keys(repo.branches), [repo.branches]);
  const colorOfBranch = (name: string): string => {
    if (name === 'master' || name === 'main') return 'var(--color-mint)';
    const i = branchNames.indexOf(name);
    return LANE_COLORS[Math.max(1, i) % LANE_COLORS.length];
  };

  // 提交颜色溯源：提交记录了创建时的分支（commit.branch），feature 提交（含 ff 合并进主线的）
  // 保留分支颜色；主干上直接创建的提交 = 米白（cream）
  const originColor = useMemo(() => {
    const map = new Map<string, string>();
    const primaryName = branchNames.includes('master') ? 'master' : 'main';
    for (const c of Object.values(repo.commits)) {
      if (c.branch && c.branch !== primaryName) map.set(c.id, colorOfBranch(c.branch));
    }
    return map;
  }, [repo, branchNames]);

  // 各分支标签（气泡）：primary 分支（master）在节点上方指向下，feature 一律在下方指向上
  const branchLabels = useMemo(() => {
    const out: { commitId: string; text: string; bg: string; lane: number; key: string; second: boolean; above: boolean }[] = [];
    for (const b of Object.values(repo.branches)) {
      if (!b.commitId || !repo.commits[b.commitId]) continue;
      const row = rowMap.get(b.commitId);
      if (!row) continue;
      const isPrimary = b.name === 'master' || b.name === 'main';
      out.push({
        commitId: b.commitId,
        text: b.name,
        bg: colorOfBranch(b.name),
        lane: row.lane,
        key: `b-${b.name}`,
        second: false,
        above: isPrimary,
      });
    }
    // 同节点多个 feature 标签向下堆叠
    const seen = new Map<string, number>();
    for (const l of out) {
      if (!l.above) {
        const n = seen.get(l.commitId) ?? 0;
        l.second = n > 0;
        seen.set(l.commitId, n + 1);
      }
    }
    return out;
  }, [repo, rowMap, branchNames]);

  const labelsByCommit = useMemo(() => {
    const m = new Map<string, typeof branchLabels>();
    for (const l of branchLabels) {
      if (!m.has(l.commitId)) m.set(l.commitId, []);
      m.get(l.commitId)!.push(l);
    }
    return m;
  }, [branchLabels]);

  // HEAD 圆环：实线 = 当前 worktree 指针；虚线 = 其他 worktree 指针
  const headRings = useMemo(() => {
    const out: { commitId: string; dashed: boolean; key: string }[] = [];
    for (const w of repo.worktrees) {
      const cid = w.head.kind === 'branch' ? repo.branches[w.head.branch!]?.commitId : w.head.commitId;
      if (!cid || !repo.commits[cid]) continue;
      out.push({ commitId: cid, dashed: w.id !== repo.activeWorktreeId, key: `h-${w.id}` });
    }
    return out;
  }, [repo]);

  // 新提交出现时滚到最右（时间线最前端）
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [rowsAsc.length]);

  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
      <div
        className="sticky top-0 z-10 flex items-baseline gap-2 px-5 py-2"
        style={{ background: 'var(--color-bg)', borderBottom: '1.5px solid var(--color-hairline)' }}
      >
        <Waypoints className="h-4 w-4 self-center" style={{ color: 'var(--color-yellow)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--color-cream)' }}>提交历史全景</span>
        <span className="mono text-[10px]" style={{ color: 'var(--color-muted)' }}>
          Commit Graph · 圆点=提交 · 圆点颜色=分支 · 黄圈=HEAD · 虚线=已被回退/重写
        </span>
      </div>

      {!repo.initialized && (
        <div className="flex h-40 items-center justify-center text-xs font-bold" style={{ color: 'var(--color-muted)' }}>
          尚未初始化 —— 执行 git init 后，这里会出现提交时间线
        </div>
      )}

      {repo.initialized && rowsAsc.length === 0 && (
        <div className="flex h-40 items-center justify-center text-xs font-bold" style={{ color: 'var(--color-muted)' }}>
          还没有任何提交 —— git add + git commit 之后，第一个提交会出现在左侧起点
        </div>
      )}

      {repo.initialized && rowsAsc.length > 0 && (
        <svg width={Math.max(width, 600)} height={height} className="block">
          <defs>
            <filter id="gnodeShadow" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* 连线：同分支水平直线；分叉/汇合为平滑贝塞尔曲线，线色跟随分支色 */}
          {rowsAsc.map((r, i) =>
            r.commit.parents.map((p) => {
              const pr = rowMap.get(p);
              if (!pr) return null;
              const pi = rowsAsc.indexOf(pr);
              const x1 = x(i);
              const y1 = y(r.lane);
              const x2 = x(pi);
              const y2 = y(pr.lane);
              const ghostEdge = r.ghost || pr.ghost;
              const color = ghostEdge
                ? GHOST_EDGE
                : originColor.get(r.commit.id) ??
                  originColor.get(pr.commit.id) ??
                  (r.lane === 0 ? MAIN_EDGE : LANE_COLORS[r.lane % LANE_COLORS.length]);
              const d =
                r.lane === pr.lane
                  ? `M ${x2} ${y2} L ${x1} ${y1}`
                  : `M ${x1} ${y1} C ${x1} ${y1 + (y2 - y1) * 0.5}, ${x2} ${y2 - (y2 - y1) * 0.5}, ${x2} ${y2}`;
              return (
                <path
                  key={`e-${r.commit.id}-${p}`}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={ghostEdge ? 2 : 2.5}
                  strokeLinecap="round"
                  strokeDasharray={ghostEdge ? '5 5' : undefined}
                  opacity={ghostEdge ? 0.8 : 0.95}
                />
              );
            }),
          )}

          {/* 节点：实心圆 = commit；颜色 = 分支；黄圈 = HEAD 所在 */}
          <AnimatePresence initial={false}>
            {rowsAsc.map((r, i) => {
              const fill = r.ghost
                ? GHOST_FILL
                : originColor.get(r.commit.id) ?? LANE_COLORS[r.lane % LANE_COLORS.length];
              const rings = headRings.filter((h) => h.commitId === r.commit.id);
              return (
                <motion.g
                  key={r.commit.id}
                  data-commit-id={r.commit.id}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: r.ghost ? 0.75 : 1, scale: 1, x: x(i), y: y(r.lane) }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  <title>{`${r.commit.hash} ${r.commit.message.split('\n')[0]}${r.ghost ? '（已被回退/重写）' : ''}`}</title>
                  {r.commit.merge && (
                    <circle r={NODE_R + 4} fill="none" stroke={fill} strokeOpacity={0.5} strokeWidth={2} />
                  )}
                  {rings.map((ring) => (
                    <circle
                      key={ring.key}
                      r={NODE_R + 6}
                      fill="none"
                      stroke="var(--color-yellow)"
                      strokeWidth={3}
                      strokeDasharray={ring.dashed ? '5 4' : undefined}
                      opacity={ring.dashed ? 0.75 : 1}
                    />
                  ))}
                  <circle
                    r={NODE_R}
                    fill={fill}
                    stroke={r.ghost ? GHOST_EDGE : 'rgba(0,0,0,0.18)'}
                    strokeWidth={r.ghost ? 2 : 1.5}
                    strokeDasharray={r.ghost ? '4 3' : undefined}
                    filter="url(#gnodeShadow)"
                  />
                  {/* 分支气泡标签：master 在节点上方（指向下），feature 在节点下方（指向上） */}
                  {(labelsByCommit.get(r.commit.id) ?? []).map((l) => (
                    <motion.g key={l.key} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                      <BranchBubble text={l.text} bg={l.bg} above={l.above} second={l.second} />
                    </motion.g>
                  ))}
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>
      )}
    </div>
  );
}
