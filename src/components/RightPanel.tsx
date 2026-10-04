import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  Circle,
  CircleCheckBig,
  Cloud,
  Copy,
  FileDiff,
  HelpCircle,
  KeyRound,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useLabStore, type RightTab } from '../store/useLabStore';
import { LESSONS } from '../tutorial/lessons';
import { activeWt, ancestors, visibleCommits } from '../git-engine/repository';

const TABS: { id: RightTab; label: string; icon: React.ReactNode }[] = [
  { id: 'tutorial', label: '实验', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: 'diff', label: 'Diff', icon: <FileDiff className="h-3.5 w-3.5" /> },
  { id: 'stash', label: 'Stash', icon: <Archive className="h-3.5 w-3.5" /> },
  { id: 'remote', label: 'Remote', icon: <Cloud className="h-3.5 w-3.5" /> },
  { id: 'help', label: '帮助', icon: <HelpCircle className="h-3.5 w-3.5" /> },
];

const cardStyle: React.CSSProperties = {
  background: 'var(--color-zone-work)',
  borderRadius: 'var(--radius-sub)',
  border: '1.5px solid var(--color-hairline)',
};

export function RightPanel() {
  const tab = useLabStore((s) => s.rightTab);
  const setTab = useLabStore((s) => s.setRightTab);
  return (
    <aside className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto px-2 py-2" style={{ borderBottom: '1.5px solid var(--color-hairline)' }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-1 text-[11px] font-bold"
              style={{
                borderRadius: 'var(--radius-chip)',
                background: active ? 'var(--color-cream)' : 'rgba(240,238,231,0.08)',
                color: active ? 'var(--color-ink)' : 'var(--color-muted)',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === 'tutorial' && <TutorialPanel />}
        {tab === 'diff' && <DiffPanel />}
        {tab === 'stash' && <StashPanel />}
        {tab === 'remote' && <RemotePanel />}
        {tab === 'help' && <HelpPanel />}
      </div>
    </aside>
  );
}

// ---------- 实验面板 ----------

function TutorialPanel() {
  const lessonId = useLabStore((s) => s.lessonId);
  const stepIndex = useLabStore((s) => s.stepIndex);
  const done = useLabStore((s) => s.lessonDone);
  const startLesson = useLabStore((s) => s.startLesson);
  const stopLesson = useLabStore((s) => s.stopLesson);
  const lesson = LESSONS.find((l) => l.id === lessonId);

  return (
    <div>
      {!lesson && (
        <>
          <div
            className="mb-3 p-3 text-[11px] font-bold leading-relaxed"
            style={{ ...cardStyle, background: 'var(--color-zone-stage)', border: '1.5px solid var(--color-zone-stage-border)', color: 'var(--color-chip-stage)' }}
          >
            <div className="mb-1">引导实验</div>
            跟着实验一步步输入真实命令，边做边看动画。选一个开始——它会重置演示项目到实验场景。
          </div>
          <div className="flex flex-col gap-2">
            {LESSONS.map((l) => (
              <button
                key={l.id}
                onClick={() => startLesson(l.id)}
                className="p-3 text-left"
                style={{ ...cardStyle }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-yellow)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-hairline)')}
              >
                <div className="flex items-center gap-2">
                  <Play className="h-3 w-3" style={{ color: 'var(--color-orange)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--color-cream)' }}>{l.title}</span>
                </div>
                <div className="mt-1 text-[11px] font-bold leading-relaxed" style={{ color: 'var(--color-muted)' }}>{l.goal}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {lesson && (
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold" style={{ color: 'var(--color-cream)' }}>{lesson.title}</div>
            <button onClick={stopLesson} className="text-[11px] font-bold" style={{ color: 'var(--color-muted)' }}>退出</button>
          </div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed" style={{ color: 'var(--color-muted)' }}>{lesson.goal}</div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => startLesson(lesson.id)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold"
              style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-cream)', color: 'var(--color-ink)' }}
            >
              <RotateCcw className="h-3 w-3" /> 重置场景
            </button>
            <div className="mono text-[11px]" style={{ color: 'var(--color-muted)' }}>
              进度 {Math.min(stepIndex, lesson.steps.length)}/{lesson.steps.length}
            </div>
          </div>

          <AnimatePresence>
            {done && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 p-3 text-[11px] font-bold"
                style={{ borderRadius: 'var(--radius-sub)', background: 'var(--color-mint)', color: 'var(--color-ink)' }}
              >
                <CircleCheckBig className="h-4 w-4" /> 实验完成！可以退出后自由练习，或重置场景再做一遍。
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 flex flex-col gap-1.5">
            {lesson.steps.map((s, i) => {
              const state = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'todo';
              const borderColor = state === 'done' ? 'var(--color-mint-border)' : state === 'current' ? 'var(--color-yellow)' : 'var(--color-hairline)';
              return (
                <motion.div
                  key={i}
                  layout
                  className="p-2.5"
                  style={{ ...cardStyle, borderWidth: 1.5, borderColor, opacity: state === 'todo' ? 0.55 : 1 }}
                >
                  <div className="flex items-start gap-2">
                    {state === 'done' ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-mint-border)' }} />
                    ) : (
                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: state === 'current' ? 'var(--color-yellow)' : 'var(--color-muted)' }} />
                    )}
                    <div className="min-w-0">
                      <div
                        className="text-[11.5px] font-bold leading-relaxed"
                        style={{ color: 'var(--color-cream)', textDecoration: state === 'done' ? 'line-through' : 'none', opacity: state === 'done' ? 0.7 : 1 }}
                      >
                        <span className="mono mr-1 text-[10px]" style={{ color: 'var(--color-muted)' }}>{i + 1}.</span>
                        {s.instruction}
                      </div>
                      {state === 'current' && s.hint && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-[10.5px] font-bold leading-relaxed" style={{ color: 'var(--color-yellow)' }}>
                          {s.hint}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Diff 面板 ----------

function DiffPanel() {
  const diff = useLabStore((s) => s.lastDiff);
  const runCommand = useLabStore((s) => s.runCommand);
  if (!diff) {
    return (
      <div>
        <div className="p-3 text-[11px] font-bold leading-relaxed" style={{ ...cardStyle, color: 'var(--color-muted)' }}>
          还没有 diff 数据。修改文件后执行 <Cmd>git diff</Cmd>（工作区 vs 最新提交）或 <Cmd>git diff --staged</Cmd>（暂存区 vs 最新提交）。
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => runCommand('git diff')} className="mono px-2.5 py-1 text-[11px] font-bold" style={{ ...cardStyle, color: 'var(--color-cream)' }}>git diff</button>
          <button onClick={() => runCommand('git diff --staged')} className="mono px-2.5 py-1 text-[11px] font-bold" style={{ ...cardStyle, color: 'var(--color-cream)' }}>git diff --staged</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 mono text-[11px] font-bold" style={{ color: 'var(--color-muted)' }}>
        {diff.scope === 'staged' ? '暂存区 vs 最新提交' : '工作区 vs 最新提交'}
      </div>
      {diff.files.map((f) => (
        <div key={f.path} className="mb-3 overflow-hidden" style={{ ...cardStyle }}>
          <div className="mono px-3 py-1.5 text-[11px] font-bold" style={{ background: 'rgba(240,238,231,0.08)', color: 'var(--color-cream)' }}>{f.path}</div>
          <div className="mono p-2 text-[10.5px] leading-relaxed">
            {f.rows.map((r, i) => (
              <div
                key={i}
                className="whitespace-pre"
                style={{
                  background: r.type === 'add' ? 'rgba(127,203,150,0.16)' : r.type === 'del' ? 'rgba(217,141,134,0.16)' : 'transparent',
                  color: r.type === 'add' ? 'var(--color-mint-border)' : r.type === 'del' ? 'var(--color-error)' : 'var(--color-muted)',
                }}
              >
                {r.type === 'add' ? '+ ' : r.type === 'del' ? '- ' : '  '}
                {r.text || ' '}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Cmd({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono px-1 text-[10.5px] font-bold" style={{ borderRadius: 'var(--radius-badge)', background: 'rgba(240,238,231,0.12)', color: 'var(--color-cream)' }}>
      {children}
    </span>
  );
}

// ---------- Stash 面板 ----------

function StashPanel() {
  const repo = useLabStore((s) => s.repo);
  const wt = activeWt(repo);
  const runCommand = useLabStore((s) => s.runCommand);
  const mine = repo.stashes.filter((s) => s.worktreeId === wt.id);
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        stash 临时收起未提交的改动（工作区+暂存区），让工作区干净、切换分支不被阻塞。
      </div>
      {!mine.length && (
        <div className="p-3 text-[11px] font-bold" style={{ ...cardStyle, color: 'var(--color-muted)' }}>
          stash 是空的。改动没写完又要切分支时，执行 <Cmd>git stash</Cmd>；回来后 <Cmd>git stash pop</Cmd>。
        </div>
      )}
      <div className="flex flex-col gap-2">
        {mine.map((s) => (
          <motion.div
            key={s.seq}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-2.5"
            style={{ ...cardStyle, background: 'var(--color-zone-stage)', border: '2px dashed var(--color-yellow)' }}
          >
            <div className="mono text-[10.5px]" style={{ color: 'var(--color-yellow)' }}>stash@{'{'}{repo.stashes.indexOf(s)}{'}'}</div>
            <div className="mt-0.5 text-[11px] font-bold" style={{ color: 'var(--color-cream)' }}>{s.label}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] font-bold" style={{ color: 'var(--color-muted)' }}>{Object.keys(s.files).length} 个文件的改动</span>
              <button
                onClick={() => runCommand('git stash pop')}
                className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold"
                style={{ borderRadius: 'var(--radius-badge)', background: 'var(--color-mint)', color: 'var(--color-ink)' }}
              >
                <ArrowDownToLine className="h-3 w-3" /> pop 取回
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------- Remote 面板 ----------

function RemotePanel() {
  const repo = useLabStore((s) => s.repo);
  const runCommand = useLabStore((s) => s.runCommand);
  const ops = useLabStore((s) => s.ops);
  const [flyKey, setFlyKey] = useState<{ dir: 'up' | 'down'; key: number } | null>(null);

  const seqRef = useState({ seq: 0 })[0];
  if (ops.seq !== seqRef.seq) {
    seqRef.seq = ops.seq;
    for (const op of ops.list) {
      if (op.type === 'PUSH_SYNCED') setFlyKey({ dir: 'up', key: Date.now() });
      if (op.type === 'PULL_SYNCED' || op.type === 'CLONED') setFlyKey({ dir: 'down', key: Date.now() });
    }
  }

  const wt = activeWt(repo);
  const branch = wt.head.branch ?? 'master';
  const localCommits = repo.branches[branch]?.commitId ? [...ancestors(repo, repo.branches[branch].commitId!)] : [];
  const localList = localCommits.map((id) => repo.commits[id]).filter(Boolean).sort((a, b) => b.order - a.order);
  const remoteId = repo.remote?.branches[branch];
  const remoteList = remoteId
    ? [...ancestors(repo, remoteId)].map((id) => repo.commits[id]).filter(Boolean).sort((a, b) => b.order - a.order)
    : [];

  return (
    <div>
      {!repo.remote ? (
        <div className="p-3 text-[11px] font-bold leading-relaxed" style={{ ...cardStyle, color: 'var(--color-muted)' }}>
          远程仓库未配置。执行 <Cmd>git remote add origin git@github.com:mark/mark-todo.git</Cmd> 开始（本实验室用模拟远程演示 push / pull / clone）。
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-cream)' }}>{repo.remote.name}</span>
            <span className="mono truncate text-[10px] font-bold" style={{ color: 'var(--color-muted)' }}>{repo.remote.url}</span>
            <button
              onClick={() => navigator.clipboard?.writeText(repo.remote!.url)}
              title="复制地址"
              style={{ color: 'var(--color-muted)' }}
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>

          <div className="relative grid grid-cols-[1fr_44px_1fr] items-stretch">
            <MiniRepo title="LOCAL 本地" commits={localList} tone="blue" branch={branch} />
            <div className="relative flex flex-col items-center justify-center gap-2">
              <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2" style={{ borderLeft: '2px dashed var(--color-hairline)' }} />
              <AnimatePresence>
                {flyKey && (
                  <motion.div
                    key={flyKey.key}
                    initial={{ y: flyKey.dir === 'up' ? 60 : -60, opacity: 0 }}
                    animate={{ y: flyKey.dir === 'up' ? -60 : 60, opacity: [0, 1, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.1, times: [0, 0.2, 0.8, 1] }}
                    className="absolute z-10 flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ background: 'var(--color-yellow)', boxShadow: 'var(--shadow-flat)' }}
                  >
                    {flyKey.dir === 'up' ? <ArrowUpFromLine className="h-3 w-3" style={{ color: 'var(--color-ink)' }} /> : <ArrowDownToLine className="h-3 w-3" style={{ color: 'var(--color-ink)' }} />}
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="z-10 px-0.5 text-[9px] font-bold" style={{ color: 'var(--color-muted)', background: 'var(--color-bg)' }}>网络</span>
            </div>
            <MiniRepo title="REMOTE 远程" commits={remoteList} tone="mint" branch={branch} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => runCommand('git push')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold" style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-blue)', color: 'var(--color-ink)', boxShadow: 'var(--shadow-flat)' }}>
              <ArrowUpFromLine className="h-3 w-3" /> git push
            </button>
            <button onClick={() => runCommand('git pull')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold" style={{ ...cardStyle, color: 'var(--color-cream)' }}>
              <ArrowDownToLine className="h-3 w-3" /> git pull
            </button>
            <button onClick={() => runCommand('git clone ' + repo.remote!.url + ' 马克代办')} className="px-2.5 py-1 text-[11px] font-bold" style={{ ...cardStyle, color: 'var(--color-cream)' }}>
              git clone（演练删库恢复）
            </button>
          </div>

          <div className="mt-3 p-3" style={{ ...cardStyle, background: 'var(--color-zone-stage)', border: '1.5px solid var(--color-zone-stage-border)' }}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--color-chip-stage)' }}>
              <KeyRound className="h-3 w-3" /> SSH Key 是怎么验证身份的
            </div>
            <div className="mt-1.5 text-[10.5px] font-bold leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              一对文件：<b>私钥</b>留在自己电脑、绝不外传；<b>公钥</b>交给 GitHub。
              推送时电脑用私钥生成一个仿不了的「签名」，GitHub 用公钥核对——对得上，就证明代码确实是你推的。
            </div>
            <div className="mono mt-2 p-2 text-[10px]" style={{ borderRadius: 'var(--radius-chip)', background: 'rgba(0,0,0,0.25)', color: 'var(--color-cream)' }}>
              ssh-keygen -t ed25519 -C "你的邮箱" → 把 ~/.ssh/id_ed25519.pub 填到 GitHub → Settings → SSH keys
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniRepo({
  title,
  commits,
  tone,
  branch,
}: {
  title: string;
  commits: { id: string; hash: string; message: string }[];
  tone: 'blue' | 'mint';
  branch: string;
}) {
  const zoneBg = tone === 'blue' ? 'var(--color-zone-stage)' : 'var(--color-zone-history)';
  const zoneBorder = tone === 'blue' ? 'var(--color-zone-stage-border)' : 'var(--color-mint-border)';
  const dot = tone === 'blue' ? 'var(--color-blue)' : 'var(--color-mint-border)';
  return (
    <div className="zone p-2.5" style={{ background: zoneBg, borderColor: zoneBorder }}>
      <div className="text-[10.5px] font-bold" style={{ color: zoneBorder }}>{title}</div>
      <div className="mono mt-0.5 text-[9.5px] font-bold" style={{ color: 'var(--color-muted)' }}>{branch}</div>
      <div className="mt-2 flex flex-col gap-1">
        {commits.slice(0, 8).map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
            <span className="mono truncate text-[10px]" style={{ color: 'var(--color-cream)' }}>{c.hash} {c.message.split('\n')[0]}</span>
          </div>
        ))}
        {!commits.length && <span className="text-[10px] font-bold" style={{ color: 'var(--color-muted)' }}>（空）</span>}
      </div>
    </div>
  );
}

// ---------- 帮助面板 ----------

function HelpPanel() {
  const total = visibleCommits(useLabStore((s) => s.repo)).length;
  return (
    <div className="text-[11px] font-bold leading-relaxed">
      <div className="p-3" style={{ ...cardStyle, background: 'var(--color-zone-history)', border: '1.5px solid var(--color-mint-border)' }}>
        <div className="text-xs font-bold" style={{ color: 'var(--color-mint)' }}>这是一个 Git 实验室</div>
        <div className="mt-1" style={{ color: 'var(--color-muted)' }}>
          在下方终端输入真实 Git 命令，观察上方三个区域与 Commit Graph 的动画变化。当前历史里有 {total} 个可见提交。
        </div>
      </div>

      <Section title="建议的第一个循环">
        <Row c="git init" d="初始化仓库（创建 .git）" />
        <Row c="git status" d="看哪些文件处于什么状态" />
        <Row c="git add index.html" d="把文件放进暂存区（或 git add .）" />
        <Row c='git commit -m "说明"' d="把暂存区打包成提交" />
        <Row c="git log --oneline" d="查看提交历史" />
      </Section>

      <Section title="分支与合并">
        <Row c="git switch -c feature/x" d="创建并切换分支" />
        <Row c="git merge feature/x" d="把分支合并进当前分支" />
        <Row c="git branch -d feature/x" d="删除已合并的分支" />
      </Section>

      <Section title="回滚">
        <Row c="git restore ." d="撤销工作区改动" />
        <Row c="git restore --staged ." d="从暂存区撤下（不动文件）" />
        <Row c="git reset --hard HEAD~1" d="删掉最近提交（三区全回退）" />
        <Row c="git revert HEAD" d="用新提交抵消旧提交" />
      </Section>

      <Section title="更多">
        <Row c="git rebase master" d="换地基；冲突后 add 再 --continue" />
        <Row c="git stash / pop" d="收起 / 取回未提交改动" />
        <Row c="git worktree add ../目录 -b 分支 master" d="开第二个工作目录" />
        <Row c="git remote add / push / pull / clone" d="远程备份与恢复" />
      </Section>

      <div className="mt-3 p-3 text-[10.5px]" style={{ ...cardStyle, color: 'var(--color-muted)' }}>
        文件改动 = 点击左侧文件编辑保存；<span className="mono">.gitignore</span> 可直接创建并写入要忽略的文件名。
        想跟步骤学？点右上角「引导实验」。
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{title}</div>
      <div className="mt-1 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Row({ c, d }: { c: string; d: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      <span className="mono w-fit px-1.5 py-0.5 text-[10px]" style={{ borderRadius: 'var(--radius-badge)', background: 'rgba(240,238,231,0.1)', color: 'var(--color-cream)' }}>{c}</span>
      <span className="text-[10.5px]" style={{ color: 'var(--color-muted)' }}>{d}</span>
    </div>
  );
}
