import { useEffect, useRef, useState, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Folder, FolderGit2, GraduationCap } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { activeWt } from '../git-engine/repository';

export function TopBar() {
  const repo = useLabStore((s) => s.repo);
  const setActiveWorktree = useLabStore((s) => s.setActiveWorktree);
  const setRightTab = useLabStore((s) => s.setRightTab);
  const rightTab = useLabStore((s) => s.rightTab);
  const lessonId = useLabStore((s) => s.lessonId);

  return (
    <header className="glass z-20 flex h-12 shrink-0 items-center gap-3 border-0 border-b border-slate-200/60 px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 shadow-sm">
          <FolderGit2 className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">Git 可视化交互实验室</div>
          <div className="text-[10px] text-slate-400">输入命令，看见 Git 的状态变化</div>
        </div>
      </div>

      <div className="mx-2 h-6 w-px bg-slate-200/80" />

      {/* Worktree 标签页 */}
      <div className="flex items-center gap-1">
        {repo.worktrees.map((w) => {
          const active = w.id === repo.activeWorktreeId;
          return (
            <motion.button
              key={w.id}
              layout
              onClick={() => setActiveWorktree(w.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white/50 text-slate-500 hover:bg-white/90'
              }`}
              title={w.id === 'wt-main' ? '主工作目录' : w.path}
            >
              {w.id === 'wt-main' ? <Folder className="h-3.5 w-3.5" /> : <FolderGit2 className="h-3.5 w-3.5" />}
              <span className="mono">{w.label}</span>
              {repo.initialized && w.head.branch && (
                <span className={`mono rounded px-1 text-[10px] ${active ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {w.head.branch}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {lessonId && (
          <button
            onClick={() => setRightTab('tutorial')}
            className="flex items-center gap-1 rounded-full bg-amber-100/90 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-200"
          >
            <GraduationCap className="h-3.5 w-3.5" /> 实验进行中
          </button>
        )}
        <button
          onClick={() => setRightTab(rightTab === 'tutorial' ? 'help' : 'tutorial')}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
            rightTab === 'tutorial' ? 'bg-amber-500 text-white hover:bg-amber-400' : 'bg-slate-900 text-white hover:bg-slate-700'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" /> 引导实验
        </button>
      </div>
    </header>
  );
}

export function StatusBar() {
  const repo = useLabStore((s) => s.repo);
  const wt = activeWt(repo);
  const ab = computeAheadBehind(repo);

  return (
    <footer className="glass z-20 flex h-7 shrink-0 items-center gap-4 border-0 border-t border-slate-200/60 px-4 text-[11px] text-slate-500">
      <span className="mono">
        {repo.initialized ? `分支 ${wt.head.branch ?? 'HEAD'}` : '未初始化（git init 开始）'}
      </span>
      {wt.mergeState && <span className="rounded bg-rose-100/90 px-1.5 text-rose-600">合并进行中 · 有未解决冲突</span>}
      {wt.rebaseState && <span className="rounded bg-amber-100/90 px-1.5 text-amber-700">变基进行中</span>}
      {repo.stashes.length > 0 && <span>stash ×{repo.stashes.length}</span>}
      {repo.worktrees.length > 1 && <span>worktree ×{repo.worktrees.length}</span>}
      <span className="ml-auto flex items-center gap-2">
        {repo.remote ? (
          <>
            <span className="mono">{repo.remote.name}: {repo.remote.url}</span>
            {ab && ab.ahead > 0 && <span className="rounded bg-sky-100/90 px-1.5 text-sky-600">ahead {ab.ahead}</span>}
            {ab && ab.behind > 0 && <span className="rounded bg-violet-100/90 px-1.5 text-violet-600">behind {ab.behind}</span>}
          </>
        ) : (
          <span>远程未配置（git remote add origin …）</span>
        )}
      </span>
    </footer>
  );
}

function computeAheadBehind(repo: ReturnType<typeof useLabStore.getState>['repo']) {
  const wt = activeWt(repo);
  if (!repo.remote || !wt.head.branch) return null;
  const remoteId = repo.remote.branches[wt.head.branch];
  const localId = repo.branches[wt.head.branch]?.commitId;
  if (!remoteId || !localId) return null;
  const localSet = new Set<string>();
  const stack = [localId];
  while (stack.length) {
    const id = stack.pop()!;
    if (localSet.has(id)) continue;
    localSet.add(id);
    stack.push(...(repo.commits[id]?.parents ?? []));
  }
  const remoteSet = new Set<string>();
  stack.push(remoteId);
  while (stack.length) {
    const id = stack.pop()!;
    if (remoteSet.has(id)) continue;
    remoteSet.add(id);
    stack.push(...(repo.commits[id]?.parents ?? []));
  }
  let ahead = 0;
  for (const id of localSet) if (!remoteSet.has(id)) ahead++;
  let behind = 0;
  for (const id of remoteSet) if (!localSet.has(id)) behind++;
  return { ahead, behind };
}
