import { useEffect, useRef, useState, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { activeWt, fileStatuses, headTree, visibleCommits } from '../git-engine/repository';
import { statusMeta } from './FileExplorer';
import { useOpsEffect } from './useOpsEffect';

function sameLines(a?: string[], b?: string[]) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((l, i) => l === b[i]);
}

interface Flight {
  key: string;
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  tone: 'emerald' | 'sky' | 'slate';
  dot?: boolean;
  delay?: number;
}

export function ThreeAreas() {
  const repo = useLabStore((s) => s.repo);
  const wt = activeWt(repo);
  const rects = useRef(new Map<string, DOMRect>());
  const setRect =
    (key: string) =>
    (el: HTMLElement | SVGElement | null): void => {
      if (el) rects.current.set(key, el.getBoundingClientRect());
    };
  const [flights, setFlights] = useState<Flight[]>([]);
  const [pulse, setPulse] = useState<{ dir: 'down' | 'up'; key: number } | null>(null);
  const [commitFlow, setCommitFlow] = useState<{ key: number } | null>(null);
  const [flashWork, setFlashWork] = useState(0);
  const [flashStash, setFlashStash] = useState(0);

  useOpsEffect((ops) => {
    let dir: 'down' | 'up' | null = null;
    let commitOp = false;
    let stashOp = false;
    for (const op of ops) {
      if (op.type === 'FILE_STAGED') dir = 'down';
      if (op.type === 'FILE_UNSTAGED') dir = 'up';
      if (op.type === 'COMMIT_CREATED') commitOp = true;
      if (op.type === 'STASH_CREATED' || op.type === 'STASH_POPPED') stashOp = true;
    }
    if (dir) setPulse({ dir, key: Date.now() });
    if (commitOp) setCommitFlow({ key: Date.now() });
    if (stashOp) setFlashStash(Date.now());
    if (op0(ops, 'FILE_RESTORED')) setFlashWork(Date.now());

    // 飞行动画：状态渲染完成后再测量起止位置
    requestAnimationFrame(() => {
      const stamp = Date.now();
      const list: Flight[] = [];
      ops.forEach((op, oi) => {
        if (op.type === 'FILE_STAGED') {
          op.paths.forEach((p, i) => {
            const from = rects.current.get(`work:${p}`);
            const to = rects.current.get(`stage:${p}`);
            if (from && to) {
              list.push({
                key: `fs${stamp}${oi}${i}`,
                label: p,
                from: { x: from.left, y: from.top },
                to: { x: to.left, y: to.top },
                tone: 'emerald',
                delay: oi * 0.05 + i * 0.06,
              });
            }
          });
        }
        if (op.type === 'FILE_UNSTAGED') {
          op.paths.forEach((p, i) => {
            const from = rects.current.get(`stage:${p}`);
            const to = rects.current.get(`work:${p}`);
            if (from && to) {
              list.push({
                key: `fu${stamp}${oi}${i}`,
                label: p,
                from: { x: from.left, y: from.top },
                to: { x: to.left, y: to.top },
                tone: 'sky',
                delay: oi * 0.05 + i * 0.06,
              });
            }
          });
        }
        if (op.type === 'COMMIT_CREATED') {
          const from = rects.current.get('stageCard');
          const node = document.querySelector(`[data-commit-id="${op.commitId}"]`);
          const to = node?.getBoundingClientRect();
          if (from && to) {
            list.push({
              key: `cc${stamp}${oi}`,
              label: '',
              from: { x: from.right - 26, y: from.top + from.height / 2 },
              to: { x: to.left + to.width / 2, y: to.top + to.height / 2 },
              tone: 'slate',
              dot: true,
              delay: oi * 0.08,
            });
          }
        }
        if (op.type === 'STASH_CREATED') {
          const from = rects.current.get('workCard');
          const to = rects.current.get('stashCard');
          if (from && to) {
            list.push({
              key: `st${stamp}${oi}`,
              label: '改动',
              from: { x: from.right - 30, y: from.top + from.height / 2 },
              to: { x: to.left + 20, y: to.top + to.height / 2 },
              tone: 'slate',
              dot: true,
            });
          }
        }
      });
      if (list.length) {
        setFlights((f) => [...f, ...list]);
        const keys = new Set(list.map((f) => f.key));
        window.setTimeout(() => setFlights((f) => f.filter((x) => !keys.has(x.key))), 950);
      }
    });
  });

  const statuses = fileStatuses(repo, wt);
  const hTree = headTree(repo, wt);
  const workFiles = statuses.filter((f) => f.path in wt.workingFiles);
  const stagedFiles = statuses.filter(
    (f) => f.path in wt.index && !sameLines(wt.index[f.path], hTree[f.path]),
  );
  const stashCount = repo.stashes.filter((s) => s.worktreeId === wt.id).length;

  return (
    <div className="shrink-0 border-b border-slate-200/70 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-600">三个区域</span>
        <span>·</span>
        <span className="mono">{wt.label}</span>
        <span>当前工作目录：{wt.id === 'wt-main' ? '.' : wt.path}</span>
      </div>
      <div className="flex items-stretch gap-2">
        {/* 工作区 */}
        <AreaCard
          title="Working Tree"
          subtitle="工作区"
          tone="slate"
          flashKey={flashWork}
          emptyHint="没有文件"
          rectKey="workCard"
          setRect={setRect}
        >
          <AnimatePresence initial={false}>
            {workFiles.map((f) => {
              const meta = statusMeta(f.status);
              return (
                <motion.div
                  key={f.path}
                  layout
                  ref={setRect(`work:${f.path}`)}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: f.ignored ? 0.4 : 1, y: 0 }}
                  exit={{ opacity: 0, y: 10, transition: { duration: 0.25 } }}
                  className={`mono flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${meta.chip}`}
                  title={f.status === 'clean' ? '与最新提交一致' : meta.label}
                >
                  <span>{f.path}</span>
                  {f.status !== 'clean' && !f.ignored && (
                    <span className="ml-auto text-[9px] font-bold">{meta.badge}</span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </AreaCard>

        {/* git add 流动箭头 */}
        <FlowArrow
          label="git add"
          sub="复制进暂存区"
          tone="emerald"
          dir={pulse?.dir ?? null}
          pulseKey={pulse?.key ?? 0}
        />

        {/* 暂存区 */}
        <AreaCard
          title="Staging Area"
          subtitle="暂存区 · index"
          tone="emerald"
          emptyHint="空 —— 与最新提交一致"
          rectKey="stageCard"
          setRect={setRect}
        >
          <AnimatePresence initial={false}>
            {stagedFiles.map((f) => {
              const meta = statusMeta(f.status);
              return (
                <motion.div
                  key={f.path}
                  layout
                  ref={setRect(`stage:${f.path}`)}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.25 } }}
                  className={`mono flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${meta.chip}`}
                >
                  <span>{f.path}</span>
                  <span className="ml-auto text-[9px] font-bold">{meta.badge}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </AreaCard>

        {/* git commit 流动箭头 */}
        <FlowArrow
          label="git commit"
          sub="打包成提交 ↓ 下方历史"
          tone="emerald"
          dir={commitFlow ? 'down' : null}
          pulseKey={commitFlow?.key ?? 0}
        />

        {/* 提交历史摘要卡 */}
        <div
          ref={setRect('historyCard')}
          className="glass flex min-w-0 flex-1 flex-col justify-center rounded-xl p-3"
        >
          <div className="text-sm font-semibold text-slate-800">Commit History</div>
          <div className="text-[10px] text-slate-400">提交历史</div>
          <div className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {repo.initialized ? (
              <>
                共 <span className="font-bold text-slate-800">{visibleCommits(repo).length - repo.ghosts.length}</span>{' '}
                个提交
                {repo.ghosts.length > 0 && (
                  <span className="text-slate-400">（另有 {repo.ghosts.length} 个虚影）</span>
                )}
                <br />
                在下方 Commit Graph 中查看，连线指向它的父提交
              </>
            ) : (
              <span className="text-slate-400">尚未初始化，执行 git init 开始</span>
            )}
          </div>
        </div>

        {/* stash 提示 */}
        <AnimatePresence>
          {stashCount > 0 && (
            <motion.div
              key="stash"
              initial={{ opacity: 0, scale: 0.9, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: 'auto' }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col justify-center"
            >
              <div
                ref={setRect('stashCard')}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${
                  stashCount ? 'border-violet-200/80 bg-violet-50/90 text-violet-700' : 'border-slate-200'
                }`}
              >
                <Archive className="h-3.5 w-3.5" />
                <div>
                  <div className="font-semibold">Stash</div>
                  <div className="mono text-[10px]">×{stashCount} 收起的改动</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 飞行芯片层 */}
      <div className="pointer-events-none fixed inset-0 z-40">
        <AnimatePresence>
          {flights.map((f) => (
            <motion.div
              key={f.key}
              initial={{ x: f.from.x, y: f.from.y, scale: 0.9, opacity: 0.95 }}
              animate={{ x: f.to.x, y: f.to.y, scale: f.dot ? 0.55 : 1, opacity: 0.95 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.6, delay: f.delay ?? 0, ease: [0.32, 0.72, 0.32, 1] }}
              className="fixed left-0 top-0"
            >
              {f.dot ? (
                <div className="h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-700 shadow-md ring-2 ring-white/70" />
              ) : (
                <div
                  className={`mono -translate-y-1/2 rounded-md border px-2 py-1 text-[10px] shadow-md ${
                    f.tone === 'emerald'
                      ? 'border-emerald-300 bg-emerald-50/95 text-emerald-700'
                      : 'border-sky-300 bg-sky-50/95 text-sky-700'
                  }`}
                >
                  {f.label}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function op0<T extends { type: string }>(ops: T[], type: string): boolean {
  return ops.some((o) => o.type === type);
}

/** SVG Path 流动箭头（替代廉价虚线箭头） */
function FlowArrow({
  label,
  sub,
  tone,
  dir,
  pulseKey,
}: {
  label: string;
  sub: string;
  tone: 'emerald';
  dir: 'down' | 'up' | null;
  pulseKey: number;
}) {
  const gid = useId().replace(/:/g, '');
  const color = '#10b981';
  const active = dir !== null;
  const forward = dir !== 'up';
  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-1">
      <div className="mono rounded-md bg-slate-100/90 px-1.5 py-0.5 text-[10px] text-slate-500">{label}</div>
      <svg width="64" height="30" viewBox="0 0 64 30">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#cbd5e1" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <path
          d="M3 15 H 50"
          stroke={`url(#${gid})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          className={active && forward ? 'flow-dash' : undefined}
          opacity={active ? 1 : 0.85}
        />
        <path
          d="M50 8.5 L 60 15 L 50 21.5"
          fill="none"
          stroke={active && forward ? color : '#94a3b8'}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {active && !forward && (
          <motion.circle
            key={`r${pulseKey}`}
            r={3.2}
            fill="#38bdf8"
            initial={{ cx: 58, cy: 15, opacity: 0 }}
            animate={{ cx: [58, 6], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.7, times: [0, 0.15, 0.85, 1] }}
          />
        )}
        {active && forward && (
          <motion.circle
            key={`f${pulseKey}`}
            r={3.2}
            fill={color}
            initial={{ cx: 4, cy: 15, opacity: 0 }}
            animate={{ cx: [4, 52], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.7, times: [0, 0.15, 0.85, 1] }}
          />
        )}
      </svg>
      <div className="text-center text-[9px] leading-tight text-slate-400">{sub}</div>
    </div>
  );
}

function AreaCard({
  title,
  subtitle,
  tone,
  emptyHint,
  flashKey,
  rectKey,
  setRect,
  children,
}: {
  title: string;
  subtitle: string;
  tone: 'slate' | 'emerald';
  emptyHint: string;
  flashKey?: number;
  rectKey: string;
  setRect: (key: string) => (el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const ring = tone === 'emerald' ? 'border-emerald-200/80' : 'border-slate-200/80';
  const head = tone === 'emerald' ? 'text-emerald-700' : 'text-slate-800';
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <motion.div
      ref={setRect(rectKey)}
      animate={flashKey ? { boxShadow: ['0 0 0 0 rgba(16,185,129,0.3)', '0 0 0 10px rgba(16,185,129,0)'] } : {}}
      className={`glass flex w-44 shrink-0 flex-col rounded-xl p-2.5 !border ${ring}`}
      style={{ minHeight: 92 }}
    >
      <div className={`text-[13px] font-semibold leading-tight ${head}`}>{title}</div>
      <div className="text-[10px] text-slate-400">{subtitle}</div>
      <div className="mt-2 flex min-h-[42px] flex-col gap-1">
        {hasChildren ? children : <div className="text-[10px] text-slate-300">{emptyHint}</div>}
      </div>
    </motion.div>
  );
}
