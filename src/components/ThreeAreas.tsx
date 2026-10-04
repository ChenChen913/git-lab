import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUpDown, Archive } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { activeWt, fileStatuses, headTree, visibleCommits } from '../git-engine/repository';
import { statusMeta } from './FileExplorer';
import { useOpsEffect } from './useOpsEffect';
import { useState } from 'react';

function sameLines(a?: string[], b?: string[]) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((l, i) => l === b[i]);
}

export function ThreeAreas() {
  const repo = useLabStore((s) => s.repo);
  const wt = activeWt(repo);
  const [pulse, setPulse] = useState<{ dir: 'down' | 'up'; key: number } | null>(null);
  const [flashWork, setFlashWork] = useState(0);
  const [flashStash, setFlashStash] = useState(0);

  useOpsEffect((ops) => {
    for (const op of ops) {
      if (op.type === 'FILE_STAGED') setPulse({ dir: 'down', key: Date.now() });
      if (op.type === 'FILE_UNSTAGED') setPulse({ dir: 'up', key: Date.now() });
      if (op.type === 'FILE_RESTORED') setFlashWork(Date.now());
      if (op.type === 'STASH_CREATED' || op.type === 'STASH_POPPED') setFlashStash(Date.now());
    }
  });

  const statuses = fileStatuses(repo, wt);
  const hTree = headTree(repo, wt);
  const workFiles = statuses.filter((f) => f.path in wt.workingFiles);
  const stagedFiles = statuses.filter(
    (f) => f.path in wt.index && !sameLines(wt.index[f.path], hTree[f.path]),
  );
  const stashCount = repo.stashes.filter((s) => s.worktreeId === wt.id).length;

  return (
    <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-600">三个区域</span>
        <span>·</span>
        <span className="mono">{wt.label}</span>
        <span>当前工作目录：{wt.id === 'wt-main' ? '.' : wt.path}</span>
      </div>
      <div className="flex items-stretch gap-2">
        {/* 工作区 */}
        <AreaCard
          title="工作区"
          subtitle="Working Directory"
          tone="slate"
          flashKey={flashWork}
          emptyHint="没有文件"
        >
          <AnimatePresence initial={false}>
            {workFiles.map((f) => {
              const meta = statusMeta(f.status);
              return (
                <motion.div
                  key={f.path}
                  layout
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

        {/* git add 箭头 */}
        <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1">
          {pulse && pulse.dir === 'up' && (
            <motion.div key={`up${pulse.key}`} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.9 }}>
              <ArrowUpDown className="h-4 w-4 text-rose-400" />
            </motion.div>
          )}
          {pulse && pulse.dir === 'down' && (
            <motion.div key={`down${pulse.key}`} initial={{ scale: 1 }} animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9 }}>
              <ArrowDown className="h-4 w-4 text-emerald-500" />
            </motion.div>
          )}
          <div className="mono rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">git add</div>
          <svg width="40" height="26" viewBox="0 0 40 26" className="text-slate-300">
            <line x1="2" y1="13" x2="30" y2="13" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
            <polygon points="30,8 38,13 30,18" fill="currentColor" />
          </svg>
          <div className="text-center text-[9px] leading-tight text-slate-400">复制进暂存区</div>
        </div>

        {/* 暂存区 */}
        <AreaCard title="暂存区" subtitle="Staging Area · index" tone="emerald" emptyHint="空 —— 与最新提交一致">
          <AnimatePresence initial={false}>
            {stagedFiles.map((f) => {
              const meta = statusMeta(f.status);
              return (
                <motion.div
                  key={f.path}
                  layout
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

        {/* commit 箭头 → 提交历史 */}
        <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1">
          <div className="mono rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">git commit</div>
          <svg width="40" height="26" viewBox="0 0 40 26" className="text-slate-300">
            <line x1="2" y1="13" x2="30" y2="13" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
            <polygon points="30,8 38,13 30,18" fill="currentColor" />
          </svg>
          <div className="text-center text-[9px] leading-tight text-slate-400">打包成提交<br />↓ 进入下方历史</div>
        </div>

        {/* 提交历史摘要卡 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs font-semibold text-slate-700">提交历史</div>
          <div className="mono mt-0.5 text-[10px] text-slate-400">Commit History</div>
          <div className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {repo.initialized ? (
              <>
                共{' '}
                <span className="font-bold text-slate-800">
                  {visibleCommits(repo).length - repo.ghosts.length}
                </span>{' '}
                个提交
                {repo.ghosts.length > 0 && (
                  <span className="text-slate-400">（另有 {repo.ghosts.length} 个被回退/重写的虚影提交）</span>
                )}
                <br />
                在下方 Commit Graph 中查看，箭头指向它的父提交
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
              <motion.div
                key={`stashf${flashStash}`}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${
                  stashCount ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200'
                }`}
                animate={flashStash ? { boxShadow: ['0 0 0 0 rgba(139,92,246,0.4)', '0 0 0 8px rgba(139,92,246,0)'] } : {}}
              >
                <Archive className="h-3.5 w-3.5" />
                <div>
                  <div className="font-semibold">stash</div>
                  <div className="mono text-[10px]">×{stashCount} 收起的改动</div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AreaCard({
  title,
  subtitle,
  tone,
  emptyHint,
  flashKey,
  children,
}: {
  title: string;
  subtitle: string;
  tone: 'slate' | 'emerald';
  emptyHint: string;
  flashKey?: number;
  children: React.ReactNode;
}) {
  const border = tone === 'emerald' ? 'border-emerald-200' : 'border-slate-200';
  const head = tone === 'emerald' ? 'text-emerald-700' : 'text-slate-700';
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <motion.div
      animate={flashKey ? { boxShadow: ['0 0 0 0 rgba(16,185,129,0.35)', '0 0 0 10px rgba(16,185,129,0)'] } : {}}
      className={`flex w-44 shrink-0 flex-col rounded-xl border ${border} bg-white p-2.5`}
      style={{ minHeight: 88 }}
    >
      <div className={`text-xs font-semibold ${head}`}>{title}</div>
      <div className="mono text-[9px] text-slate-400">{subtitle}</div>
      <div className="mt-2 flex min-h-[40px] flex-col gap-1">
        {hasChildren ? children : <div className="text-[10px] text-slate-300">{emptyHint}</div>}
      </div>
    </motion.div>
  );
}
