import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FilePlus2, FileText } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { fileStatuses, activeWt, type FileStatus } from '../git-engine/repository';

const STATUS_META: Record<FileStatus, { label: string; dot: string; badge: string; chip: string }> = {
  untracked: { label: '未跟踪', dot: 'bg-amber-400', badge: 'U', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  modified: { label: '已修改', dot: 'bg-amber-500', badge: 'M', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  staged: { label: '已暂存', dot: 'bg-emerald-500', badge: 'S', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  'staged+modified': { label: '暂存后又改', dot: 'bg-emerald-500', badge: 'S·M', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  clean: { label: '干净', dot: 'bg-slate-300', badge: '', chip: 'border-slate-200 bg-white text-slate-600' },
};

export function statusMeta(s: FileStatus) {
  return STATUS_META[s];
}

export function FileExplorer() {
  const repo = useLabStore((s) => s.repo);
  const openEditor = useLabStore((s) => s.openEditor);
  const setNewFileOpen = useLabStore((s) => s.setNewFileOpen);
  const wt = activeWt(repo);
  const files = useMemo(() => fileStatuses(repo, wt), [repo, wt]);

  return (
    <aside className="flex min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="text-xs font-semibold text-slate-700">文件（工作目录）</div>
        <button
          onClick={() => setNewFileOpen(true)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="新建文件"
        >
          <FilePlus2 className="h-3.5 w-3.5" /> 新建
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!files.length && (
          <div className="px-2 py-6 text-center text-xs text-slate-400">文件夹是空的</div>
        )}
        <AnimatePresence initial={false}>
          {files.map((f) => {
            const meta = STATUS_META[f.status];
            return (
              <motion.button
                key={f.path}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: f.ignored ? 0.45 : 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onClick={() => openEditor(f.path)}
                className={`mono flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-100 ${
                  f.ignored ? 'italic text-slate-400' : 'text-slate-700'
                }`}
                title={f.ignored ? '被 .gitignore 忽略' : `${f.path} · ${meta.label}（点击编辑，相当于在编辑器里改代码）`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{f.path}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {!f.ignored && f.status !== 'clean' && (
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  )}
                  {!f.ignored && meta.badge && (
                    <span className={`rounded border px-1 text-[10px] ${meta.chip}`}>{meta.badge}</span>
                  )}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="border-t border-slate-100 px-3 py-2 text-[10px] leading-relaxed text-slate-400">
        点击文件 = 打开编辑器改代码；U 未跟踪 / M 已修改 / S 已暂存
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-6" onClick={() => openEditor(null)}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-[70vh] w-[720px] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="mono text-sm font-semibold text-slate-800">{editing}</div>
          <button onClick={() => openEditor(null)} className="text-xs text-slate-400 hover:text-slate-600">
            取消（Esc）
          </button>
        </div>
        <div className="border-b border-slate-100 bg-amber-50 px-5 py-2 text-[11px] text-amber-700">
          这里相当于 VS Code：改完代码保存，Git 状态区会立刻反映「工作区改动」。
          {modified && ' 注意：该文件已有未提交改动。'}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="mono min-h-0 flex-1 resize-none bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 outline-none"
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={() => openEditor(null)} className="rounded-lg px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
            取消
          </button>
          <button
            onClick={() => saveFile(editing, draft)}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40" onClick={() => setNewFileOpen(false)}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-96 rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-slate-800">新建文件</div>
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
          className="mono mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setNewFileOpen(false)} className="rounded-lg px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-100">取消</button>
          <button
            onClick={() => {
              if (name.trim()) {
                createFile(name.trim());
                setName('');
              }
            }}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            创建
          </button>
        </div>
        <div className="mt-3 text-[11px] leading-relaxed text-slate-400">
          想试 .gitignore？创建它并写入要忽略的文件名（每行一个），git status 就会安静下来。
        </div>
      </motion.div>
    </div>
  );
}
