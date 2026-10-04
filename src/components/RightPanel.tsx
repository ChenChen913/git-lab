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

export function RightPanel() {
  const tab = useLabStore((s) => s.rightTab);
  const setTab = useLabStore((s) => s.setRightTab);
  return (
    <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-100 px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
              tab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
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
    <div className="p-3">
      {!lesson && (
        <>
          <div className="mb-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-[11px] leading-relaxed text-amber-800">
            <div className="mb-1 font-semibold">引导实验</div>
            跟着实验一步步输入真实命令，边做边看动画。选一个开始——它会重置演示项目到实验场景。
          </div>
          <div className="flex flex-col gap-2">
            {LESSONS.map((l) => (
              <button
                key={l.id}
                onClick={() => startLesson(l.id)}
                className="group rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/50"
              >
                <div className="flex items-center gap-2">
                  <Play className="h-3 w-3 text-amber-500" />
                  <span className="text-xs font-semibold text-slate-800">{l.title}</span>
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{l.goal}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {lesson && (
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-800">{lesson.title}</div>
            <button onClick={stopLesson} className="text-[11px] text-slate-400 hover:text-slate-600">退出</button>
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{lesson.goal}</div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => startLesson(lesson.id)}
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-700"
            >
              <RotateCcw className="h-3 w-3" /> 重置场景
            </button>
            <div className="text-[11px] text-slate-400">
              进度 {Math.min(stepIndex, lesson.steps.length)}/{lesson.steps.length}
            </div>
          </div>

          <AnimatePresence>
            {done && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-[11px] font-medium text-emerald-700"
              >
                <CircleCheckBig className="h-4 w-4" /> 实验完成！可以退出后自由练习，或重置场景再做一遍。
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 flex flex-col gap-1.5">
            {lesson.steps.map((s, i) => {
              const state = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'todo';
              return (
                <motion.div
                  key={i}
                  layout
                  className={`rounded-xl border p-2.5 ${
                    state === 'done'
                      ? 'border-emerald-100 bg-emerald-50/60'
                      : state === 'current'
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-100 bg-white opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {state === 'done' ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${state === 'current' ? 'text-amber-500' : 'text-slate-300'}`} />
                    )}
                    <div className="min-w-0">
                      <div className={`text-[11.5px] leading-relaxed ${state === 'done' ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>
                        <span className="mono mr-1 text-[10px] text-slate-400">{i + 1}.</span>
                        {s.instruction}
                      </div>
                      {state === 'current' && s.hint && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-[10.5px] leading-relaxed text-amber-700">
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
      <div className="p-3">
        <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
          还没有 diff 数据。修改文件后执行 <Cmd>git diff</Cmd>（工作区 vs 最新提交）或 <Cmd>git diff --staged</Cmd>（暂存区 vs 最新提交）。
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => runCommand('git diff')} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50">git diff</button>
          <button onClick={() => runCommand('git diff --staged')} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50">git diff --staged</button>
        </div>
      </div>
    );
  }
  return (
    <div className="p-3">
      <div className="mb-2 text-[11px] text-slate-400">
        {diff.scope === 'staged' ? '暂存区 vs 最新提交' : '工作区 vs 最新提交'}
      </div>
      {diff.files.map((f) => (
        <div key={f.path} className="mb-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="mono border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">{f.path}</div>
          <pre className="mono overflow-auto p-2 text-[10.5px] leading-relaxed">
            {f.rows.map((r, i) => (
              <div
                key={i}
                className={
                  r.type === 'add' ? 'bg-emerald-50 text-emerald-700' : r.type === 'del' ? 'bg-rose-50 text-rose-600' : 'text-slate-400'
                }
              >
                {r.type === 'add' ? '+ ' : r.type === 'del' ? '- ' : '  '}
                {r.text || ' '}
              </div>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
}

function Cmd({ children }: { children: React.ReactNode }) {
  return <span className="mono rounded bg-slate-200/70 px-1 text-[10.5px] text-slate-700">{children}</span>;
}

// ---------- Stash 面板 ----------

function StashPanel() {
  const repo = useLabStore((s) => s.repo);
  const wt = activeWt(repo);
  const runCommand = useLabStore((s) => s.runCommand);
  const mine = repo.stashes.filter((s) => s.worktreeId === wt.id);
  return (
    <div className="p-3">
      <div className="mb-2 text-[11px] leading-relaxed text-slate-400">
        stash 临时收起未提交的改动（工作区+暂存区），让工作区干净、切换分支不被阻塞。
      </div>
      {!mine.length && (
        <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-400">
          stash 是空的。改动没写完又要切分支时，执行 <Cmd>git stash</Cmd>；回来后 <Cmd>git stash pop</Cmd>。
        </div>
      )}
      <div className="flex flex-col gap-2">
        {mine.map((s) => (
          <motion.div key={s.seq} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-violet-200 bg-violet-50/60 p-2.5">
            <div className="mono text-[10.5px] text-violet-700">stash@{'{'}{repo.stashes.indexOf(s)}{'}'}</div>
            <div className="mt-0.5 text-[11px] text-slate-600">{s.label}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{Object.keys(s.files).length} 个文件的改动</span>
              <button
                onClick={() => runCommand('git stash pop')}
                className="ml-auto flex items-center gap-1 rounded-lg bg-violet-600 px-2 py-0.5 text-[10.5px] text-white hover:bg-violet-500"
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

  // 消费动画操作：push/pull 时触发飞点
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
    <div className="p-3">
      {!repo.remote ? (
        <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-400">
          远程仓库未配置。执行 <Cmd>git remote add origin git@github.com:mark/mark-todo.git</Cmd> 开始（本实验室用模拟远程演示 push / pull / clone）。
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">{repo.remote.name}</span>
            <span className="mono truncate text-[10px] text-slate-400">{repo.remote.url}</span>
            <button
              onClick={() => navigator.clipboard?.writeText(repo.remote!.url)}
              className="text-slate-300 hover:text-slate-500"
              title="复制地址"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>

          <div className="relative grid grid-cols-[1fr_44px_1fr] items-stretch">
            <MiniRepo title="LOCAL 本地" commits={localList} tone="sky" branch={branch} />
            <div className="relative flex flex-col items-center justify-center gap-2">
              <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-slate-300" />
              <AnimatePresence>
                {flyKey && (
                  <motion.div
                    key={flyKey.key}
                    initial={{ y: flyKey.dir === 'up' ? 60 : -60, opacity: 0 }}
                    animate={{ y: flyKey.dir === 'up' ? -60 : 60, opacity: [0, 1, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.1, times: [0, 0.2, 0.8, 1] }}
                    className="absolute z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 shadow"
                  >
                    {flyKey.dir === 'up' ? <ArrowUpFromLine className="h-3 w-3 text-emerald-400" /> : <ArrowDownToLine className="h-3 w-3 text-sky-400" />}
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="z-10 rounded bg-white px-0.5 text-[9px] text-slate-400">网络</span>
            </div>
            <MiniRepo title="REMOTE 远程" commits={remoteList} tone="emerald" branch={branch} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => runCommand('git push')} className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-700">
              <ArrowUpFromLine className="h-3 w-3" /> git push
            </button>
            <button onClick={() => runCommand('git pull')} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
              <ArrowDownToLine className="h-3 w-3" /> git pull
            </button>
            <button onClick={() => runCommand('git clone ' + repo.remote!.url + ' 马克代办')} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50">
              git clone（演练删库恢复）
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <KeyRound className="h-3 w-3" /> SSH Key 是怎么验证身份的
            </div>
            <div className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">
              一对文件：<b>私钥</b>留在自己电脑、绝不外传；<b>公钥</b>交给 GitHub。
              推送时电脑用私钥生成一个仿不了的「签名」，GitHub 用公钥核对——对得上，就证明代码确实是你推的。
            </div>
            <div className="mono mt-2 rounded-lg bg-white p-2 text-[10px] text-slate-500">
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
  tone: 'sky' | 'emerald';
  branch: string;
}) {
  const color = tone === 'sky' ? 'text-sky-600' : 'text-emerald-600';
  const dot = tone === 'sky' ? 'bg-sky-500' : 'bg-emerald-500';
  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <div className={`text-[10.5px] font-bold ${color}`}>{title}</div>
      <div className="mono mt-0.5 text-[9.5px] text-slate-400">{branch}</div>
      <div className="mt-2 flex flex-col gap-1">
        {commits.slice(0, 8).map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            <span className="mono truncate text-[10px] text-slate-500">{c.hash} {c.message.split('\n')[0]}</span>
          </div>
        ))}
        {!commits.length && <span className="text-[10px] text-slate-300">（空）</span>}
      </div>
    </div>
  );
}

// ---------- 帮助面板 ----------

function HelpPanel() {
  const total = visibleCommits(useLabStore((s) => s.repo)).length;
  return (
    <div className="p-3 text-[11px] leading-relaxed text-slate-600">
      <div className="rounded-xl bg-gradient-to-br from-slate-50 to-sky-50 p-3">
        <div className="text-xs font-bold text-slate-800">这是一个 Git 实验室</div>
        <div className="mt-1 text-slate-500">
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

      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[10.5px] text-slate-500">
        文件改动 = 点击左侧文件编辑保存；<span className="mono">.gitignore</span> 可直接创建并写入要忽略的文件名。
        想跟步骤学？点右上角「引导实验」。
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-1 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Row({ c, d }: { c: string; d: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      <span className="mono w-fit rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">{c}</span>
      <span className="text-[10.5px] leading-snug text-slate-500">{d}</span>
    </div>
  );
}
