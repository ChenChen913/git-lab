import { useEffect, useRef, useState } from 'react';
import { TerminalSquare } from 'lucide-react';
import { promptText, useLabStore, type TerminalLine } from '../store/useLabStore';

const KIND_COLOR: Record<string, string> = {
  info: 'var(--t-text)',
  muted: 'var(--t-muted)',
  success: 'var(--t-ok)',
  error: 'var(--t-error)',
  add: 'var(--t-ok)',
  del: 'var(--t-error)',
  hint: 'var(--t-info)',
  meta: 'var(--t-warn)',
  warn: 'var(--t-warn)',
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
    <div className="flex h-56 shrink-0 flex-col" style={{ background: 'var(--t-bg)', borderTop: '1.5px solid var(--t-hairline)' }} onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 px-4 py-1.5" style={{ borderBottom: '1.5px solid var(--t-hairline)' }}>
        <TerminalSquare className="h-3.5 w-3.5" style={{ color: 'var(--t-muted)' }} />
        <span className="text-[11px] font-bold" style={{ color: 'var(--t-text)' }}>Terminal</span>
        <span className="text-[10px] font-bold" style={{ color: 'var(--t-muted)' }}>终端</span>
        <div className="ml-4 flex items-center gap-1">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={(e) => {
                e.stopPropagation();
                runCommand(q);
              }}
              className="mono px-1.5 py-0.5 text-[10px]"
              style={{ borderRadius: 'var(--radius-badge)', background: 'rgba(240,238,231,0.1)', color: 'var(--t-muted)' }}
            >
              {q}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] font-bold" style={{ color: 'var(--t-muted)' }}>↑/↓ 翻历史 · Ctrl+L 清屏</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
        {lines.map((l: TerminalLine) => (
          <div key={l.id} className="mono whitespace-pre-wrap text-[11.5px] leading-relaxed" style={{ color: KIND_COLOR[l.kind] ?? 'var(--t-text)' }}>
            {l.prompt && <span className="mr-2" style={{ color: 'var(--t-ok)' }}>{l.prompt}</span>}
            {l.text}
          </div>
        ))}
        <div className="mono flex items-center gap-2 text-[11.5px]">
          <span style={{ color: 'var(--t-ok)' }}>{promptText(repo)}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            autoComplete="off"
            className="mono flex-1 bg-transparent outline-none"
            style={{ color: 'var(--t-text)', caretColor: 'var(--t-ok)' }}
            placeholder="输入 git 命令并回车…"
          />
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
