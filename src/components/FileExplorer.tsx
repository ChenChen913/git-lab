import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FilePlus2 } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { fileStatuses, activeWt, type FileStatus } from '../git-engine/repository';

const BADGE: Record<FileStatus, { text: string; c: string } | null> = {
  untracked: { text: '未跟踪', c: 'var(--color-orange)' },
  modified: { text: '已修改', c: 'var(--color-yellow)' },
  staged: { text: '已暂存', c: 'var(--color-mint-border)' },
  'staged+modified': { text: '暂存后又改', c: 'var(--color-yellow)' },
  clean: null,
};

/** 文件类型小图标（与三区面板同一语义） */
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

export { FileIcon };

export function FileExplorer() {
  const repo = useLabStore((s) => s.repo);
  const openEditor = useLabStore((s) => s.openEditor);
  const setNewFileOpen = useLabStore((s) => s.setNewFileOpen);
  const wt = activeWt(repo);
  const files = useMemo(() => fileStatuses(repo, wt), [repo, wt]);

  return (
    <aside className="flex min-h-0 flex-col p-3">
      <div
        className="flat-card flex min-h-0 flex-1 flex-col p-3"
        style={{ background: 'var(--color-zone-work)' }}
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--color-cream)' }}>文件</div>
            <div className="mono text-[10px] font-bold" style={{ color: 'var(--color-muted)' }}>Working Directory</div>
          </div>
          <button
            onClick={() => setNewFileOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold"
            style={{ borderRadius: 'var(--radius-badge)', background: 'rgba(240,238,231,0.1)', color: 'var(--color-cream)' }}
            title="新建文件"
          >
            <FilePlus2 className="h-3.5 w-3.5" /> 新建
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto pt-1">
          {!files.length && (
            <div className="px-2 py-6 text-center text-xs font-bold" style={{ color: 'var(--color-muted)' }}>文件夹是空的</div>
          )}
          <AnimatePresence initial={false}>
            {files.map((f) => {
              const badge = BADGE[f.status];
              return (
                <motion.button
                  key={f.path}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: f.ignored ? 0.45 : 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  onClick={() => openEditor(f.path)}
                  className="mono mb-1.5 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px]"
                  style={{
                    borderRadius: 'var(--radius-chip)',
                    background: f.ignored ? 'transparent' : 'var(--color-cream)',
                    color: 'var(--color-ink)',
                    border: f.ignored ? '1.5px dashed var(--color-muted)' : 'none',
                    boxShadow: f.ignored ? 'none' : 'var(--shadow-flat)',
                  }}
                  title={f.ignored ? '被 .gitignore 忽略' : `${f.path} · 点击编辑（相当于在编辑器里改代码）`}
                >
                  <FileIcon path={f.path} />
                  <span className="truncate">{f.path}</span>
                  <span className="ml-auto">{badge && !f.ignored && <span className="badge-outline" style={{ color: badge.c }}>{badge.text}</span>}</span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="px-1 pt-2 text-[10px] font-bold leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          点击文件 = 打开编辑器改代码
        </div>
      </div>
      <EditorModal />
      <NewFileModal />
    </aside>
  );
}

function EditorModal() {
  const repo = useLabStore((s) => s.repo);
  const editing = useLabStore((s) => s.editing);
  const openEditor = useLabStore((s) => s.openEditor);
  const saveFile = useLabStore((s) => s.saveFile);
  const [draft, setDraft] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const wt = activeWt(repo);

  if (editing && loadedFor !== editing) {
    setDraft((wt.workingFiles[editing] ?? []).join('\n'));
    setLoadedFor(editing);
  }
  if (!editing) {
    if (loadedFor) setLoadedFor(null);
    return null;
  }

  const headTree = wt.head.branch ? repo.commits[repo.branches[wt.head.branch]?.commitId ?? '']?.tree : undefined;
  const tracked = !!headTree && editing in headTree;
  const modified = tracked && (wt.workingFiles[editing] ?? []).join('\n') !== (headTree?.[editing] ?? []).join('\n');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => openEditor(null)}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flat-card flex h-[70vh] w-[720px] max-w-full flex-col overflow-hidden"
        style={{ background: 'var(--color-zone-work)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1.5px solid var(--color-hairline)' }}>
          <div className="mono text-sm font-bold" style={{ color: 'var(--color-cream)' }}>{editing}</div>
          <button onClick={() => openEditor(null)} className="text-xs font-bold" style={{ color: 'var(--color-muted)' }}>
            取消（Esc）
          </button>
        </div>
        <div className="px-5 py-2 text-[11px] font-bold" style={{ background: 'rgba(233,213,163,0.12)', color: 'var(--color-warn)', borderBottom: '1.5px solid var(--color-hairline)' }}>
          这里相当于 VS Code：改完代码保存，Git 状态区会立刻反映「工作区改动」。
          {modified && ' 注意：该文件已有未提交改动。'}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="mono min-h-0 flex-1 resize-none p-4 text-xs leading-relaxed outline-none"
          style={{ background: 'var(--color-bg)', color: 'var(--color-cream)' }}
        />
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: '1.5px solid var(--color-hairline)' }}>
          <button onClick={() => openEditor(null)} className="px-4 py-1.5 text-xs font-bold" style={{ borderRadius: 'var(--radius-chip)', color: 'var(--color-muted)' }}>
            取消
          </button>
          <button
            onClick={() => saveFile(editing, draft)}
            className="px-4 py-1.5 text-xs font-bold"
            style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-mint)', color: 'var(--color-ink)', boxShadow: 'var(--shadow-flat)' }}
          >
            保存改动
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function NewFileModal() {
  const newFileOpen = useLabStore((s) => s.newFileOpen);
  const setNewFileOpen = useLabStore((s) => s.setNewFileOpen);
  const createFile = useLabStore((s) => s.createFile);
  const [name, setName] = useState('');
  if (!newFileOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setNewFileOpen(false)}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flat-card w-96 p-5"
        style={{ background: 'var(--color-zone-work)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-bold" style={{ color: 'var(--color-cream)' }}>新建文件</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              createFile(name.trim());
              setName('');
            }
          }}
          placeholder="例如 notes.txt 或 .gitignore"
          className="mono mt-3 w-full px-3 py-2 text-xs outline-none"
          style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-bg)', color: 'var(--color-cream)', border: '1.5px solid var(--color-hairline)' }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setNewFileOpen(false)} className="px-4 py-1.5 text-xs font-bold" style={{ borderRadius: 'var(--radius-chip)', color: 'var(--color-muted)' }}>取消</button>
          <button
            onClick={() => {
              if (name.trim()) {
                createFile(name.trim());
                setName('');
              }
            }}
            className="px-4 py-1.5 text-xs font-bold"
            style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-mint)', color: 'var(--color-ink)', boxShadow: 'var(--shadow-flat)' }}
          >
            创建
          </button>
        </div>
        <div className="mt-3 text-[11px] font-bold leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          想试 .gitignore？创建它并写入要忽略的文件名（每行一个），git status 就会安静下来。
        </div>
      </motion.div>
    </div>
  );
}
