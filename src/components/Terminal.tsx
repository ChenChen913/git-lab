import { useEffect, useRef, useState } from 'react';
import { TerminalSquare } from 'lucide-react';
import { promptText, useLabStore, type TerminalLine } from '../store/useLabStore';

const KIND_CLASS: Record<string, string> = {
  info: 'text-slate-200',
  muted: 'text-slate-500',
  success: 'text-emerald-400',
  error: 'text-rose-400',
  add: 'text-emerald-400',
  del: 'text-rose-400',
  hint: 'text-sky-400',
  meta: 'text-amber-300',
  warn: 'text-amber-400',
};

const QUICK = ['git init', 'git status', 'git add .', 'git commit -m "Update"', 'git log --oneline', 'git diff', 'help'];

export function Terminal() {
  const lines = useLabStore((s) => s.lines);
  const runCommand = useLabStore((s) => s.runCommand);
  const repo = useLabStore((s) => s.repo);
  const [input, setInput] = useState('');
  const historyRef = useRef<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);

  const submit = () => {
    const raw = input;
    runCommand(raw);
    if (raw.trim()) {
      historyRef.current.push(raw);
      setHIdx(-1);
    }
    setInput('');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = historyRef.current;
      if (!h.length) return;
      const next = hIdx < 0 ? h.length - 1 : Math.max(0, hIdx - 1);
      setHIdx(next);
      setInput(h[next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const h = historyRef.current;
      if (hIdx < 0) return;
      const next = hIdx + 1;
      if (next >= h.length) {
        setHIdx(-1);
        setInput('');
      } else {
        setHIdx(next);
        setInput(h[next]);
      }
    } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runCommand('clear');
    }
  };

  return (
    <div className="flex h-56 shrink-0 flex-col border-t border-slate-800 bg-slate-900" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-1.5">
        <TerminalSquare className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-300">Terminal</span>
        <span className="text-[10px] text-slate-600">终端</span>
        <div className="ml-4 flex items-center gap-1">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={(e) => {
                e.stopPropagation();
                runCommand(q);
              }}
              className="mono rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            >
              {q}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-slate-600">↑/↓ 翻历史 · Ctrl+L 清屏</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
        {lines.map((l: TerminalLine) => (
          <div key={l.id} className={`mono whitespace-pre-wrap text-[11.5px] leading-relaxed ${KIND_CLASS[l.kind] ?? 'text-slate-300'}`}>
            {l.prompt && <span className="mr-2 text-emerald-500/90">{l.prompt}</span>}
            {l.text}
          </div>
        ))}
        <div className="mono flex items-center gap-2 text-[11.5px]">
          <span className="text-emerald-500/90">{promptText(repo)}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
            className="mono flex-1 bg-transparent text-slate-100 caret-emerald-400 outline-none"
            placeholder="输入 git 命令并回车…"
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
