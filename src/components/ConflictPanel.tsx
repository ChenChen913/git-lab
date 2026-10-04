import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Pencil } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { activeWt } from '../git-engine/repository';

/** 合并/变基冲突面板：双方版本对照 + 四种解决方式 */
export function ConflictPanel() {
  const repo = useLabStore((s) => s.repo);
  const resolveConflict = useLabStore((s) => s.resolveConflict);
  const runCommand = useLabStore((s) => s.runCommand);
  const wt = activeWt(repo);

  const conflictMap = wt.mergeState?.conflicts ?? wt.rebaseState?.conflicts ?? {};
  const paths = Object.keys(conflictMap);
  const [selected, setSelected] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);

  const path = selected && paths.includes(selected) ? selected : paths[0];
  const info = path ? conflictMap[path] : null;

  const markerText = useMemo(() => {
    if (!info || !wt.mergeState && !wt.rebaseState) return '';
    const branch = wt.mergeState?.theirsBranch ?? wt.rebaseState?.ontoBranch ?? '';
    return ['<<<<<<< HEAD', ...info!.ours, '=======', ...info!.theirs, `>>>>>>> ${branch}`].join('\n');
  }, [info, wt]);

  if (paths.length === 0) return null;
  const isRebase = !!wt.rebaseState;
  const nextCmd = isRebase ? 'git rebase --continue' : 'git commit';
  const resolved = info?.resolved ?? false;
  const staged = path ? (wt.index[path]?.join('\n') ?? '') : '';

  return (
    <AnimatePresence>
      <motion.div
        key="conflict"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6"
      >
        <motion.div
          initial={{ scale: 0.95, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          className="flex max-h-[82vh] w-[860px] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 bg-rose-50 px-5 py-3">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <div>
              <div className="text-sm font-semibold text-rose-700">
                {isRebase ? '变基冲突（rebase）' : '合并冲突（merge）'}
              </div>
              <div className="text-[11px] text-rose-500">
                两条分支改了同一个位置、内容不同——Git 无法替你决定，需要你来裁决
              </div>
            </div>
            <button
              onClick={() => runCommand(isRebase ? 'git rebase --abort' : 'git merge --abort')}
              className="ml-auto rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-100"
            >
              放弃（--abort）
            </button>
          </div>

          {/* 文件切换 */}
          {paths.length > 1 && (
            <div className="flex gap-1 border-b border-slate-100 px-5 pt-2">
              {paths.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setSelected(p);
                    setManual(null);
                  }}
                  className={`mono rounded-t-lg px-3 py-1.5 text-[11px] ${
                    p === path ? 'bg-slate-100 font-semibold text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {p} {conflictMap[p].resolved ? '✓' : '·'}
                </button>
              ))}
            </div>
          )}

          {info && (
            <div className="min-h-0 flex-1 overflow-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <SidePanel title={`HEAD（当前分支）`} lines={info.ours} tone="sky" />
                <SidePanel
                  title={isRebase ? `被重放的提交（${wt.rebaseState!.ontoBranch} 的对立面）` : `合入分支（${wt.mergeState!.theirsBranch}）`}
                  lines={info.theirs}
                  tone="orange"
                />
              </div>

              {manual === null ? (
                <>
                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <div className="mb-1 text-[11px] font-semibold text-slate-500">Git 写入文件的冲突标记（供你理解现场）</div>
                    <pre className="mono overflow-auto text-[10.5px] leading-relaxed text-slate-500">{markerText}</pre>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">解决方式：</span>
                    <ResolveBtn label="采用当前分支" desc="只留 HEAD 版本" onClick={() => resolveConflict(path!, info!.ours.join('\n'))} />
                    <ResolveBtn label="采用合入分支" desc="只留对方版本" onClick={() => resolveConflict(path!, info!.theirs.join('\n'))} />
                    <ResolveBtn label="两个都保留" desc="ours + theirs 顺序合并" onClick={() => resolveConflict(path!, [...info!.ours, ...info!.theirs].join('\n'))} />
                    <ResolveBtn label="手动编辑" desc="自己改到满意" icon onClick={() => setManual(info!.resolved ? staged || info!.ours.join('\n') : markerText)} />
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <Pencil className="h-3 w-3" /> 手动编辑（删掉 &lt;&lt;&lt;&lt;&lt;&lt;&lt; / ======= / &gt;&gt;&gt;&gt;&gt;&gt;&gt; 三行标记，改成你想要的最终内容）
                  </div>
                  <textarea
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    spellCheck={false}
                    className="mono h-56 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed outline-none focus:border-slate-400"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => setManual(null)} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">返回</button>
                    <button
                      onClick={() => {
                        resolveConflict(path!, manual!);
                        setManual(null);
                      }}
                      className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      保存解决结果
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-3">
            {resolved ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-600">
                <Check className="h-3 w-3" /> 冲突已解决（还差最后两步）
              </span>
            ) : (
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] text-rose-500">待解决</span>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
              <Step n={1} label="解决冲突（上方按钮或手动编辑）" done={resolved} />
              <span>→</span>
              <Step n={2} label="git add ." done={!!staged && !staged.includes('<<<<<<<')} />
              <span>→</span>
              <Step n={3} label={nextCmd} done={false} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SidePanel({ title, lines, tone }: { title: string; lines: string[]; tone: 'sky' | 'orange' }) {
  const cls = tone === 'sky' ? 'border-sky-200 bg-sky-50' : 'border-orange-200 bg-orange-50';
  const text = tone === 'sky' ? 'text-sky-700' : 'text-orange-700';
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <div className={`text-[11px] font-bold ${text}`}>{title}</div>
      <pre className="mono mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
        {lines.length ? lines.join('\n') : '（空）'}
      </pre>
    </div>
  );
}

function ResolveBtn({ label, desc, onClick, icon }: { label: string; desc: string; onClick: () => void; icon?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-slate-100 ${
        icon ? 'border-dashed border-slate-300' : 'border-slate-200'
      }`}
    >
      {icon && <Pencil className="h-3.5 w-3.5 text-slate-400" />}
      <span>
        <span className="block text-xs font-semibold text-slate-700">{label}</span>
        <span className="block text-[10px] text-slate-400">{desc}</span>
      </span>
    </button>
  );
}

function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
      <span className="mono">{n}</span> {label}
    </span>
  );
}
