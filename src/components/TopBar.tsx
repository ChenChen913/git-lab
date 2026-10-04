import { Folder, FolderGit2, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLabStore } from '../store/useLabStore';
import { activeWt } from '../git-engine/repository';

export function TopBar() {
  const repo = useLabStore((s) => s.repo);
  const setActiveWorktree = useLabStore((s) => s.setActiveWorktree);
  const setRightTab = useLabStore((s) => s.setRightTab);
  const rightTab = useLabStore((s) => s.rightTab);
  const lessonId = useLabStore((s) => s.lessonId);

  return (
    <header
      className="z-20 flex h-12 shrink-0 items-center gap-3 px-4"
      style={{ background: 'var(--color-panel)', borderBottom: '1.5px solid var(--color-hairline)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center"
          style={{ borderRadius: 'var(--radius-badge)', background: 'var(--color-orange)', boxShadow: 'var(--shadow-flat)' }}
        >
          <FolderGit2 className="h-4 w-4" style={{ color: 'var(--color-ink)' }} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>Git 可视化交互实验室</div>
          <div className="text-[10px] font-bold" style={{ color: 'var(--color-muted)' }}>输入命令，看见 Git 的状态变化</div>
        </div>
      </div>

      <div className="mx-2 h-6 w-px" style={{ background: 'var(--color-hairline)' }} />

      {/* Worktree 标签页 */}
      <div className="flex items-center gap-1.5">
        {repo.worktrees.map((w) => {
          const active = w.id === repo.activeWorktreeId;
          return (
            <motion.button
              key={w.id}
              layout
              onClick={() => setActiveWorktree(w.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
              style={{
                borderRadius: 'var(--radius-chip)',
                background: active ? 'var(--color-ink)' : 'rgba(30,43,58,0.06)',
                color: active ? 'var(--color-cream)' : 'var(--color-muted)',
                boxShadow: active ? 'var(--shadow-flat)' : 'none',
              }}
              title={w.id === 'wt-main' ? '主工作目录' : w.path}
            >
              {w.id === 'wt-main' ? <Folder className="h-3.5 w-3.5" /> : <FolderGit2 className="h-3.5 w-3.5" />}
              <span className="mono">{w.label}</span>
              {repo.initialized && w.head.branch && (
                <span
                  className="mono px-1 text-[10px]"
                  style={{
                    borderRadius: 'var(--radius-badge)',
                    background: active ? 'rgba(240,238,231,0.2)' : 'rgba(30,43,58,0.1)',
                  }}
                >
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
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold"
            style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-yellow)', color: 'var(--color-ink)' }}
          >
            <GraduationCap className="h-3.5 w-3.5" /> 实验进行中
          </button>
        )}
        <button
          onClick={() => setRightTab(rightTab === 'tutorial' ? 'help' : 'tutorial')}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold"
          style={{
            borderRadius: 'var(--radius-chip)',
            background: rightTab === 'tutorial' ? 'var(--color-orange)' : 'var(--color-mint)',
            color: 'var(--color-ink)',
            boxShadow: 'var(--shadow-flat)',
          }}
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
    <footer
      className="z-20 flex h-7 shrink-0 items-center gap-4 px-4 text-[11px]"
      style={{ background: 'var(--color-panel)', borderTop: '1.5px solid var(--color-hairline)', color: 'var(--color-muted)' }}
    >
      <span className="mono">
        {repo.initialized ? `分支 ${wt.head.branch ?? 'HEAD'}` : '未初始化（git init 开始）'}
      </span>
      {wt.mergeState && (
        <span className="badge-outline" style={{ color: 'var(--color-error)' }}>合并进行中 · 有未解决冲突</span>
      )}
      {wt.rebaseState && (
        <span className="badge-outline" style={{ color: 'var(--color-warn)' }}>变基进行中</span>
      )}
      {repo.stashes.length > 0 && <span className="mono">stash ×{repo.stashes.length}</span>}
      {repo.worktrees.length > 1 && <span className="mono">worktree ×{repo.worktrees.length}</span>}
      <span className="ml-auto flex items-center gap-2">
        {repo.remote ? (
          <>
            <span className="mono">{repo.remote.name}: {repo.remote.url}</span>
            {ab && ab.ahead > 0 && <span className="badge-outline" style={{ color: 'var(--color-info)' }}>ahead {ab.ahead}</span>}
            {ab && ab.behind > 0 && <span className="badge-outline" style={{ color: 'var(--color-warn)' }}>behind {ab.behind}</span>}
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
