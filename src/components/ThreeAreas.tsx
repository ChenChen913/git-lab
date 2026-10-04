import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { activeWt, fileStatuses, headTree, visibleCommits } from '../git-engine/repository';
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
  tone: 'stage' | 'work' | 'dot';
  dot?: boolean;
  delay?: number;
}

/** 文件类型小图标：HTML 橙、Markdown 蓝、JS 黄、CSS 薄荷 */
function FileIcon({ path, size = 18 }: { path: string; size?: number }) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const meta: Record<string, { bg: string; fg: string; glyph: string }> = {
    html: { bg: 'var(--color-orange)', fg: '#fff', glyph: '</>' },
    md: { bg: 'var(--color-blue)', fg: '#fff', glyph: 'M' },
    js: { bg: 'var(--color-yellow)', fg: 'var(--color-ink)', glyph: 'JS' },
    css: { bg: 'var(--color-mint)', fg: 'var(--color-ink)', glyph: '#' },
  };
  const m = meta[ext] ?? { bg: 'var(--color-cream)', fg: 'var(--color-ink)', glyph: path.slice(0, 1).toUpperCase() };
  return (
    <span
      className="mono inline-flex shrink-0 items-center justify-center rounded-md"
      style={{ width: size, height: size, background: m.bg, color: m.fg, fontSize: size <= 18 ? 9 : 10 }}
    >
      {m.glyph}
    </span>
  );
}

/** 文件状态徽章（描边式小圆角徽章） */
function StatusBadge({ status }: { status: string }) {
  if (status === 'clean') return null;
  const map: Record<string, { text: string; c: string }> = {
    untracked: { text: '未跟踪', c: 'var(--color-orange)' },
    modified: { text: '已修改', c: 'var(--color-yellow)' },
    staged: { text: '已暂存', c: 'var(--color-mint-border)' },
    'staged+modified': { text: '暂存后又改', c: 'var(--color-yellow)' },
  };
  const m = map[status];
  return (
    <span className="badge-outline shrink-0" style={{ color: m.c }}>
      {m.text}
    </span>
  );
}

/** 粗块状命令箭头：箭身叠加等宽命令文字 */
function BlockArrow({
  label,
  tone,
  activeKey,
}: {
  label: string;
  tone: 'blue' | 'green';
  activeKey: number;
}) {
  const color = tone === 'blue' ? 'var(--color-blue)' : 'var(--color-mint-border)';
  return (
    <div className="flex shrink-0 items-center justify-center">
      <motion.svg
        key={activeKey}
        width={118}
        height={36}
        viewBox="0 0 118 36"
        animate={activeKey ? { x: [0, 7, 0] } : {}}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{ overflow: 'visible' }}
      >
        <polygon
          points="0,9 84,9 84,2 116,18 84,34 84,27 0,27"
          fill={color}
          style={{ filter: 'var(--shadow-flat)' }}
        />
        <text x="40" y="22.5" textAnchor="middle" fontSize="13" className="mono" fill="var(--color-ink)">
          {label}
        </text>
      </motion.svg>
    </div>
  );
}

export function ThreeAreas() {
  const repo = useLabStore((s) => s.repo);
  const wt = activeWt(repo);
  const rects = useRef(new Map<string, DOMRect>());
  const setRect =
    (key: string) =>
    (el: HTMLElement | null): void => {
      if (el) rects.current.set(key, el.getBoundingClientRect());
    };
  const [flights, setFlights] = useState<Flight[]>([]);
  const [addPulse, setAddPulse] = useState(0);
  const [commitPulse, setCommitPulse] = useState(0);
  const [flashWork, setFlashWork] = useState(0);
  const [flashStash, setFlashStash] = useState(0);

  useOpsEffect((ops) => {
    for (const op of ops) {
      if (op.type === 'FILE_STAGED') setAddPulse(Date.now());
      if (op.type === 'FILE_UNSTAGED') setAddPulse(Date.now());
      if (op.type === 'COMMIT_CREATED') setCommitPulse(Date.now());
      if (op.type === 'STASH_CREATED' || op.type === 'STASH_POPPED') setFlashStash(Date.now());
      if (op.type === 'FILE_RESTORED') setFlashWork(Date.now());
    }
    requestAnimationFrame(() => {
      const stamp = Date.now();
      const list: Flight[] = [];
      ops.forEach((op, oi) => {
        if (op.type === 'FILE_STAGED') {
          op.paths.forEach((p, i) => {
            const from = rects.current.get(`work:${p}`);
            const to = rects.current.get(`stage:${p}`);
            if (from && to) {
              list.push({ key: `fs${stamp}${oi}${i}`, label: p, from: { x: from.left, y: from.top }, to: { x: to.left, y: to.top }, tone: 'stage', delay: i * 0.06 });
            }
          });
        }
        if (op.type === 'FILE_UNSTAGED') {
          op.paths.forEach((p, i) => {
            const from = rects.current.get(`stage:${p}`);
            const to = rects.current.get(`work:${p}`);
            if (from && to) {
              list.push({ key: `fu${stamp}${oi}${i}`, label: p, from: { x: from.left, y: from.top }, to: { x: to.left, y: to.top }, tone: 'work', delay: i * 0.06 });
            }
          });
        }
        if (op.type === 'COMMIT_CREATED') {
          const from = rects.current.get('stageCard');
          const to = rects.current.get('historyCard');
          if (from && to) {
            list.push({ key: `cc${stamp}${oi}`, label: '', from: { x: from.right - 30, y: from.top + 40 }, to: { x: to.left + 60, y: to.top + 40 }, tone: 'dot', delay: oi * 0.08 });
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

  // Commit N 子卡片：按时间顺序编号，取最近 2 个（幽灵提交不计入）
  const liveCommits = visibleCommits(repo).filter((c) => !repo.ghosts.some((g) => g.id === c.id));
  const chrono = [...liveCommits].sort((a, b) => a.order - b.order);
  const shown = chrono.slice(-2);

  return (
    <div className="shrink-0 px-5 py-3" style={{ borderBottom: '1.5px solid var(--color-hairline)' }}>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-bold" style={{ color: 'var(--color-cream)' }}>三个区域</span>
        <span className="mono text-[11px]" style={{ color: 'var(--color-muted)' }}>
          {wt.label} · 当前工作目录：{wt.id === 'wt-main' ? '.' : wt.path}
        </span>
      </div>

      <div className="flex items-stretch gap-3" style={{ height: 262 }}>
        {/* 工作区（深灰底） */}
        <ZoneCard
          title="工作区"
          titleColor="var(--color-cream)"
          bg="var(--color-zone-work)"
          border="transparent"
          rectKey="workCard"
          setRect={setRect}
          flashKey={flashWork}
          flashColor="rgba(240,238,231,0.35)"
        >
          <AnimatePresence initial={false}>
            {workFiles.map((f) => (
              <motion.div
                key={f.path}
                layout
                ref={setRect(`work:${f.path}`)}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: f.ignored ? 0.4 : 1, y: 0 }}
                exit={{ opacity: 0, y: 10, transition: { duration: 0.25 } }}
                className="mono flex items-center gap-2 px-2.5 py-1.5 text-[12px]"
                style={{
                  borderRadius: 'var(--radius-chip)',
                  background: f.ignored ? 'transparent' : 'var(--color-cream)',
                  color: 'var(--color-ink)',
                  border: f.ignored ? '1.5px dashed var(--color-muted)' : 'none',
                  boxShadow: f.ignored ? 'none' : 'var(--shadow-flat)',
                }}
                title={f.status === 'clean' ? '与最新提交一致' : undefined}
              >
                <FileIcon path={f.path} />
                <span className="truncate">{f.path}</span>
                {!f.ignored && <span className="ml-auto"><StatusBadge status={f.status} /></span>}
              </motion.div>
            ))}
          </AnimatePresence>
          {!workFiles.length && <EmptyHint>没有文件</EmptyHint>}
        </ZoneCard>

        {/* git add：蓝箭头（目标=暂存区） */}
        <BlockArrow label="git add" tone="blue" activeKey={addPulse} />

        {/* .git 逻辑分组框（浅色虚线圆角框） */}
        <div
          className="relative flex min-w-0 items-stretch gap-3 px-5 pb-3 pt-9"
          style={{ border: '2px dashed rgba(30,43,58,0.3)', borderRadius: 'var(--radius-card)' }}
        >
          <div className="mono absolute -top-3 left-4 flex items-center gap-1.5 px-1 text-[15px]" style={{ color: 'var(--color-ink)', background: 'var(--color-panel)' }}>
            <GitBranch className="h-4 w-4" style={{ color: 'var(--color-orange)' }} />
            .git
          </div>

          {/* 暂存区（深蓝底 + 亮蓝描边） */}
          <ZoneCard
            title="暂存区"
            titleColor="var(--color-zone-stage-border)"
            bg="var(--color-zone-stage)"
            border="var(--color-zone-stage-border)"
            rectKey="stageCard"
            setRect={setRect}
          >
            <AnimatePresence initial={false}>
              {stagedFiles.map((f) => (
                <motion.div
                  key={f.path}
                  layout
                  ref={setRect(`stage:${f.path}`)}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.25 } }}
                  className="mono flex items-center gap-2 px-2.5 py-1.5 text-[12px]"
                  style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-chip-stage)', color: 'var(--color-ink)', boxShadow: 'var(--shadow-flat)' }}
                >
                  <FileIcon path={f.path} />
                  <span className="truncate">{f.path}</span>
                  <span className="ml-auto"><StatusBadge status={f.status === 'staged+modified' ? 'modified' : 'staged'} /></span>
                </motion.div>
              ))}
            </AnimatePresence>
            {!stagedFiles.length && <EmptyHint>空 —— 与最新提交一致</EmptyHint>}
          </ZoneCard>

          {/* git commit：绿箭头（目标=提交历史） */}
          <BlockArrow label="git commit" tone="green" activeKey={commitPulse} />

          {/* 提交历史（深绿底 + 亮绿描边，内嵌 Commit N 子卡片） */}
          <ZoneCard
            title="提交历史"
            titleColor="var(--color-mint)"
            bg="var(--color-zone-history)"
            border="var(--color-mint-border)"
            rectKey="historyCard"
            setRect={setRect}
            scroll
          >
            {repo.initialized ? (
              <>
                {shown.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-2 py-1"
                    style={{
                      borderRadius: 'var(--radius-sub)',
                      background: 'rgba(0,0,0,0.24)',
                      border: '1.5px solid var(--color-mint-border)',
                    }}
                    title={`${c.hash} ${c.message}`}
                  >
                    <div className="mono text-[11px]" style={{ color: 'var(--color-mint)' }}>
                      Commit {c.order}
                      <span className="ml-2" style={{ color: 'var(--color-on-dark-muted)' }}>{c.hash}</span>
                    </div>
                    <div className="mt-0.5 flex flex-col gap-0.5">
                      {Object.keys(c.tree).slice(0, 2).map((p) => (
                        <div
                          key={p}
                          className="mono flex items-center gap-1.5 px-1.5 py-0.5 text-[10px]"
                          style={{ borderRadius: 8, background: 'rgba(127,203,150,0.16)', color: 'var(--color-cream)' }}
                        >
                          <FileIcon path={p} size={12} />
                          <span className="truncate">{p}</span>
                        </div>
                      ))}
                      {Object.keys(c.tree).length > 2 && (
                        <div className="mono text-[9px]" style={{ color: 'var(--color-muted)' }}>
                          +{Object.keys(c.tree).length - 2} 个文件
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {!shown.length && <EmptyHint>还没有提交</EmptyHint>}
                <div className="mono mt-auto pt-1 text-[10px]" style={{ color: 'var(--color-on-dark-muted)' }}>
                  共 {chrono.length} 个提交{repo.ghosts.length > 0 ? ` · 虚影 ${repo.ghosts.length}` : ''} · 完整时间线见下方 Commit Graph
                </div>
              </>
            ) : (
              <EmptyHint>尚未初始化，执行 git init 开始</EmptyHint>
            )}
          </ZoneCard>
        </div>

        {/* stash（收起的改动） */}
        <AnimatePresence>
          {stashCount > 0 && (
            <motion.div
              key="stash"
              initial={{ opacity: 0, scale: 0.92, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: 'auto' }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="flex flex-col justify-center"
            >
              <div
                ref={setRect('stashCard')}
                className="flex flex-col justify-center px-3 py-2"
                style={{
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--color-zone-work)',
                  border: '2px dashed var(--color-yellow)',
                  boxShadow: 'var(--shadow-flat)',
                }}
                title="stash：临时收起的未提交改动（git stash pop 取回）"
              >
                <div className="mono text-[12px]" style={{ color: 'var(--color-yellow)' }}>stash</div>
                <div className="mono text-[10px]" style={{ color: 'var(--color-on-dark-muted)' }}>×{stashCount} 收起的改动</div>
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
              animate={{ x: f.to.x, y: f.to.y, scale: f.dot ? 0.5 : 1, opacity: 0.95 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.6, delay: f.delay ?? 0, ease: [0.32, 0.72, 0.32, 1] }}
              className="fixed left-0 top-0"
            >
              {f.dot ? (
                <div className="h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'var(--color-yellow)', boxShadow: 'var(--shadow-flat)' }} />
              ) : (
                <div
                  className="mono flex -translate-y-1/2 items-center gap-1.5 px-2.5 py-1.5 text-[12px]"
                  style={{
                    borderRadius: 'var(--radius-chip)',
                    background: f.tone === 'stage' ? 'var(--color-chip-stage)' : 'var(--color-cream)',
                    color: 'var(--color-ink)',
                    boxShadow: 'var(--shadow-flat)',
                  }}
                >
                  <FileIcon path={f.label} />
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

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] font-bold" style={{ color: 'var(--color-on-dark-muted)' }}>{children}</div>;
}

function ZoneCard({
  title,
  titleColor,
  bg,
  border,
  rectKey,
  setRect,
  flashKey,
  flashColor,
  scroll,
  children,
}: {
  title: string;
  titleColor: string;
  bg: string;
  border: string;
  rectKey: string;
  setRect: (key: string) => (el: HTMLElement | null) => void;
  flashKey?: number;
  flashColor?: string;
  scroll?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      ref={setRect(rectKey)}
      animate={flashKey ? { boxShadow: ['0 0 0 0 ' + flashColor, '0 0 0 10px rgba(0,0,0,0)'] } : 'none'}
      className="zone flex w-52 shrink-0 flex-col p-3"
      style={{ background: bg, borderColor: border, height: '100%' }}
    >
      <div className="mb-2 text-[15px] font-bold" style={{ color: titleColor }}>
        {title}
      </div>
      <div className={`flex min-h-0 flex-1 flex-col gap-1.5 ${scroll ? 'overflow-auto' : ''}`}>
        {children}
      </div>
    </motion.div>
  );
}
