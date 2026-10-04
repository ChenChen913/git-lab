import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Pencil } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { activeWt } from '../git-engine/repository';
import { diffLines } from '../git-engine/text';

/** 合并/变基冲突面板：双方版本对照 + 四种解决方式（扁平卡片风） */
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
    if (!info || (!wt.mergeState && !wt.rebaseState)) return '';
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
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: 'rgba(30,43,58,0.35)' }}
      >
        <motion.div
          initial={{ scale: 0.95, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          className="flat-card flex max-h-[82vh] w-[880px] max-w-full flex-col overflow-hidden"
          style={{ background: 'var(--color-panel)' }}
        >
          <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1.5px solid var(--color-hairline)' }}>
            <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--color-error)' }}>
                {isRebase ? 'Rebase Conflict' : 'Merge Conflict'}
              </div>
              <div className="text-[11px] font-bold" style={{ color: 'var(--color-muted)' }}>
                {isRebase ? '变基冲突' : '合并冲突'}：两条分支改了同一个位置、内容不同——Git 无法替你决定，需要你来裁决
              </div>
            </div>
            <button
              onClick={() => runCommand(isRebase ? 'git rebase --abort' : 'git merge --abort')}
              className="mono ml-auto px-3 py-1 text-xs font-bold"
              style={{ borderRadius: 'var(--radius-chip)', border: '1.5px solid var(--color-error)', color: 'var(--color-error)' }}
            >
              放弃（--abort）
            </button>
          </div>

          {/* 文件切换 */}
          {paths.length > 1 && (
            <div className="flex gap-1 px-5 pt-2" style={{ borderBottom: '1.5px solid var(--color-hairline)' }}>
              {paths.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setSelected(p);
                    setManual(null);
                  }}
                  className="mono px-3 py-1.5 text-[11px] font-bold"
                  style={{
                    borderRadius: 'var(--radius-chip) var(--radius-chip) 0 0',
                    background: p === path ? 'rgba(240,238,231,0.1)' : 'transparent',
                    color: p === path ? 'var(--color-cream)' : 'var(--color-muted)',
                  }}
                >
                  {p} {conflictMap[p].resolved ? '✓' : '·'}
                </button>
              ))}
            </div>
          )}

          {info && (
            <div className="min-h-0 flex-1 overflow-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <SidePanel title="HEAD（当前分支）" lines={info.ours} other={info.theirs} tone="blue" />
                <SidePanel
                  title={isRebase ? `被重放的提交（${wt.rebaseState!.ontoBranch} 的对立面）` : `合入分支（${wt.mergeState!.theirsBranch}）`}
                  lines={info.theirs}
                  other={info.ours}
                  tone="orange"
                />
              </div>

              {manual === null ? (
                <>
                  <div className="mt-4 p-3" style={{ ...cardDark, background: 'var(--color-bg)' }}>
                    <div className="mb-1 text-[11px] font-bold" style={{ color: 'var(--color-muted)' }}>Git 写入文件的冲突标记（供你理解现场）</div>
                    <pre className="mono overflow-auto text-[10.5px] leading-relaxed" style={{ color: 'var(--color-ink)' }}>{markerText}</pre>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--color-cream)' }}>解决方式：</span>
                    <ResolveBtn label="采用当前分支" desc="只留 HEAD 版本" onClick={() => resolveConflict(path!, info!.ours.join('\n'))} />
                    <ResolveBtn label="采用合入分支" desc="只留对方版本" onClick={() => resolveConflict(path!, info!.theirs.join('\n'))} />
                    <ResolveBtn label="两个都保留" desc="ours + theirs 顺序合并" onClick={() => resolveConflict(path!, [...info!.ours, ...info!.theirs].join('\n'))} />
                    <ResolveBtn label="手动编辑" desc="自己改到满意" icon onClick={() => setManual(info!.resolved ? staged || info!.ours.join('\n') : markerText)} />
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--color-muted)' }}>
                    <Pencil className="h-3 w-3" /> 手动编辑（删掉 &lt;&lt;&lt;&lt;&lt;&lt;&lt; / ======= / &gt;&gt;&gt;&gt;&gt;&gt;&gt; 三行标记，改成你想要的最终内容）
                  </div>
                  <textarea
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    spellCheck={false}
                    className="mono h-56 w-full resize-none p-3 text-[11px] leading-relaxed outline-none"
                    style={{ ...cardDark, background: 'var(--color-bg)', color: 'var(--color-ink)', border: '1.5px solid var(--color-hairline)', borderRadius: 'var(--radius-sub)' }}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => setManual(null)} className="px-3 py-1.5 text-xs font-bold" style={{ color: 'var(--color-muted)' }}>返回</button>
                    <button
                      onClick={() => {
                        resolveConflict(path!, manual!);
                        setManual(null);
                      }}
                      className="px-4 py-1.5 text-xs font-bold"
                      style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-mint)', color: 'var(--color-ink)', boxShadow: 'var(--shadow-flat)' }}
                    >
                      保存解决结果
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 px-5 py-3" style={{ borderTop: '1.5px solid var(--color-hairline)' }}>
            {resolved ? (
              <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold" style={{ borderRadius: 'var(--radius-badge)', background: 'var(--color-mint)', color: 'var(--color-ink)' }}>
                <Check className="h-3 w-3" /> 冲突已解决（还差最后两步）
              </span>
            ) : (
              <span className="badge-outline" style={{ color: 'var(--color-error)' }}>待解决</span>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs">
              <Step n={1} label="解决冲突（上方按钮或手动编辑）" done={resolved} />
              <span style={{ color: 'var(--color-muted)' }}>→</span>
              <Step n={2} label="git add ." done={!!staged && !staged.includes('<<<<<<<')} />
              <span style={{ color: 'var(--color-muted)' }}>→</span>
              <Step n={3} label={nextCmd} done={false} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const cardDark: React.CSSProperties = {
  borderRadius: 'var(--radius-sub)',
  border: '1.5px solid var(--color-hairline)',
};

function SidePanel({
  title,
  lines,
  other,
  tone,
}: {
  title: string;
  lines: string[];
  other: string[];
  tone: 'blue' | 'orange';
}) {
  const flags = useMemo(() => diffFlags(lines, other), [lines, other]);
  const boxRef = useRef<HTMLDivElement>(null);
  // 自动滚动到第一处差异
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const first = el.querySelector('[data-ch="1"]');
    if (first) el.scrollTop = Math.max(0, (first as HTMLElement).offsetTop - 48);
  }, [lines, other]);

  // 语义：当前分支 = 蓝色分区；合入分支 = 橙色分区
  const zoneBg = tone === 'blue' ? 'var(--color-zone-stage)' : '#4a3a28';
  const zoneBorder = tone === 'blue' ? 'var(--color-zone-stage-border)' : 'var(--color-orange)';
  const titleColor = tone === 'blue' ? 'var(--color-blue)' : 'var(--color-orange)';
  const hl = tone === 'blue' ? 'rgba(133,172,227,0.32)' : 'rgba(236,167,99,0.32)';

  return (
    <div className="zone p-3" style={{ background: zoneBg, borderColor: zoneBorder }}>
      <div className="text-[11px] font-bold" style={{ color: titleColor }}>{title}</div>
      <div ref={boxRef} className="mono relative mt-1.5 max-h-40 overflow-auto rounded-lg p-2 text-[11px] leading-relaxed" style={{ background: 'rgba(0,0,0,0.28)' }}>
        {lines.length ? (
          lines.map((l, i) => (
            <div
              key={i}
              data-ch={flags[i] ? 1 : 0}
              className="whitespace-pre rounded"
              style={{ background: flags[i] ? hl : 'transparent', color: flags[i] ? 'var(--color-on-dark)' : 'var(--color-on-dark-muted)' }}
            >
              {l || ' '}
            </div>
          ))
        ) : (
          <span style={{ color: 'var(--color-on-dark-muted)' }}>（空）</span>
        )}
      </div>
    </div>
  );
}

/** 标记 a 中与 b 不同的行（用于高亮差异） */
function diffFlags(a: string[], b: string[]): boolean[] {
  const rows = diffLines(a, b);
  const flags: boolean[] = [];
  let i = 0;
  for (const r of rows) {
    if (r.type === 'same') flags[i++] = false;
    else if (r.type === 'del') flags[i++] = true;
  }
  while (flags.length < a.length) flags.push(true);
  return flags.slice(0, a.length);
}

function ResolveBtn({ label, desc, onClick, icon }: { label: string; desc: string; onClick: () => void; icon?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 text-left"
      style={{
        borderRadius: 'var(--radius-sub)',
        background: 'var(--color-panel)',
        color: 'var(--color-ink)',
        boxShadow: 'var(--shadow-flat)',
        border: icon ? '2px dashed rgba(30,43,58,0.35)' : '1.5px solid var(--color-hairline)',
      }}
    >
      {icon && <Pencil className="h-3.5 w-3.5" />}
      <span>
        <span className="block text-xs font-bold">{label}</span>
        <span className="block text-[10px]" style={{ opacity: 0.65 }}>{desc}</span>
      </span>
    </button>
  );
}

function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold"
      style={{
        borderRadius: 'var(--radius-badge)',
        background: done ? 'var(--color-mint)' : 'rgba(30,43,58,0.08)',
        color: done ? 'var(--color-ink)' : 'var(--color-muted)',
      }}
    >
      <span className="mono">{n}</span> {label}
    </span>
  );
}
