import type { Repository, Worktree } from '../types';
import { executeCommand } from '../git-engine/engine';
import { editLine, ADD_BTN_LINE } from '../sample/project';
import { activeWt } from '../git-engine/repository';

export interface LessonContext {
  repo: Repository;
  wt: Worktree;
  lastCommand: string;
}

export interface LessonStep {
  instruction: string;
  hint?: string;
  check: (ctx: LessonContext) => boolean;
}

export type SetupItem = string | { edit: string; find: string; replace: string[] };

export interface Lesson {
  id: string;
  title: string;
  goal: string;
  setup: SetupItem[];
  steps: LessonStep[];
}

/** 执行实验的前置脚本（git 命令 + 文件编辑），构造出实验场景 */
export function runSetup(base: Repository, setup: SetupItem[]): Repository {
  let repo = structuredClone(base);
  for (const item of setup) {
    if (typeof item === 'string') {
      const res = executeCommand(repo, item);
      if (res.repo) repo = res.repo;
    } else {
      const next = structuredClone(repo);
      const wt = next.worktrees.find((w) => w.id === next.activeWorktreeId) ?? next.worktrees[0];
      const lines = wt.workingFiles[item.edit];
      if (lines) editLine(lines, item.find, item.replace);
      repo = next;
    }
  }
  return repo;
}

const commitCount = (r: Repository) => Object.keys(r.commits).length;
const cleanWork = (wt: Worktree) => Object.keys(wt.workingFiles).length > 0;

export const LESSONS: Lesson[] = [
  {
    id: 'lesson-01',
    title: '实验 01 · 第一次存档',
    goal: '初始化仓库，把 index.html 保存成第一个版本',
    setup: [],
    steps: [
      { instruction: '执行 git init，把当前文件夹变成 Git 仓库', hint: '观察：右侧三个区域面板与提交历史区被点亮，默认分支 master 出现', check: (c) => c.repo.initialized },
      { instruction: '执行 git status，看看 Git 发现了什么', hint: 'index.html 目前是 untracked：Git 看到了它，但还没有开始跟踪', check: (c) => c.lastCommand === 'status' },
      { instruction: '执行 git add index.html，把页面代码放进暂存区', hint: '观察：文件芯片从「工作区」移动到「暂存区」', check: (c) => 'index.html' in c.wt.index },
      { instruction: '执行 git commit -m "Add homepage"，创建第一个提交', hint: '观察：暂存区内容打包成 commit，master 指针指向它', check: (c) => commitCount(c.repo) === 1 },
      { instruction: '执行 git log，查看这条提交的完整信息', hint: '提交编号像身份证号一样唯一；按流程走完即完成实验', check: (c) => c.lastCommand === 'log' },
    ],
  },
  {
    id: 'lesson-02',
    title: '实验 02 · 日常修改循环',
    goal: '体验 修改 → diff → add → commit 的日常节奏',
    setup: ['git init', 'git add .', 'git commit -m "Initial commit"'],
    steps: [
      { instruction: '在左侧文件列表点击 README.md，把「具体内容待补充」改成真实计划，保存', hint: '保存后文件标记为 modified（工作区有改动但未暂存）', check: (c) => !sameAsHead(c, 'README.md') },
      { instruction: '执行 git diff，查看改动的具体内容', hint: '＋ 新增的行，− 删除的行；右侧 Diff 面板同步展示', check: (c) => c.lastCommand === 'diff' },
      { instruction: '执行 git add README.md', hint: '改动进入暂存区，准备好被提交', check: (c) => 'README.md' in c.wt.index && !sameAsHeadIndex(c, 'README.md') },
      { instruction: '执行 git commit -m "补充 README"', hint: '观察：新 commit 出现，master 前移', check: (c) => commitCount(c.repo) === 2 },
    ],
  },
  {
    id: 'lesson-03',
    title: '实验 03 · 分支是指针',
    goal: '理解「分支只是贴在提交上的标签，不是代码的复制」',
    setup: ['git init', 'git add .', 'git commit -m "Initial commit"'],
    steps: [
      { instruction: '执行 git branch feature/due-date（只创建，不切换）', hint: '观察：新标签贴在同一个提交上，文件区没有任何变化', check: (c) => 'feature/due-date' in c.repo.branches && c.wt.head.branch === 'master' },
      { instruction: '执行 git branch 查看分支列表', hint: '* 标出当前所在分支', check: (c) => c.lastCommand === 'branch' },
      { instruction: '执行 git switch feature/due-date', hint: '观察：HEAD 徽标移动到新分支', check: (c) => c.wt.head.branch === 'feature/due-date' },
      { instruction: '修改 index.html（比如加一个按钮行）并执行 git add . 与 git commit -m "添加功能"', hint: '提交只落在 feature/due-date 上', check: (c) => commitCount(c.repo) === 2 && c.wt.head.branch === 'feature/due-date' },
      { instruction: '执行 git switch master，再执行 git merge feature/due-date', hint: '观察：master 指针快进，两条分支指向同一提交', check: (c) => c.repo.branches['master']?.commitId === c.repo.branches['feature/due-date']?.commitId && commitCount(c.repo) === 2 },
    ],
  },
  {
    id: 'lesson-04',
    title: '实验 04 · 冲突现场',
    goal: '亲手制造一次合并冲突，并理解它为什么发生',
    setup: [
      'git init', 'git add .', 'git commit -m "Initial commit"',
      'git switch -c feature/complete-all',
      { edit: 'index.html', find: ADD_BTN_LINE, replace: [ADD_BTN_LINE, '      <button id="complete-btn">全部完成</button>'] },
      'git add .', 'git commit -m "添加全部完成按钮"',
      'git switch master',
      { edit: 'index.html', find: ADD_BTN_LINE, replace: [ADD_BTN_LINE, '      <button id="sort-btn">排序</button>'] },
      'git add .', 'git commit -m "添加排序按钮"',
    ],
    steps: [
      { instruction: '执行 git merge feature/complete-all，触发冲突', hint: '两条分支都想在「添加」按钮后面插入不同的按钮——Git 不知道该留哪个', check: (c) => !!c.wt.mergeState },
      { instruction: '在冲突面板点击「两个都保留」', hint: '对比 HEAD（当前分支）与合入分支的版本，再决定怎么合', check: (c) => !!c.wt.mergeState?.conflicts['index.html']?.resolved },
      { instruction: '执行 git add . 把解决结果放进暂存区', hint: '解决冲突后需要暂存，Git 才认账', check: (c) => { const s = c.wt.index['index.html']; return !!s && !s.some((l) => l.startsWith('<<<<<<<') || l.startsWith('>>>>>>>')); } },
      { instruction: '执行 git commit -m "同时保留两个按钮"，完成合并', hint: '观察：合并提交有两个父提交，两条历史线在这里汇合', check: (c) => !c.wt.mergeState && Object.values(c.repo.commits).some((x) => x.parents.length === 2) },
    ],
  },
  {
    id: 'lesson-05',
    title: '实验 05 · 后悔药',
    goal: '分清 restore / revert / reset 三种回滚的适用场景',
    setup: [
      'git init', 'git add .', 'git commit -m "Initial commit"',
      { edit: 'styles.css', find: 'body { font-family: sans-serif; background: #f6f8fb; }', replace: ['body { font-family: sans-serif; background: #1a1a2e; }'] },
    ],
    steps: [
      { instruction: '执行 git restore styles.css，撤销工作区里未提交的改动', hint: '观察：文件芯片闪烁后恢复原样——改动彻底消失', check: (c) => sameAsHead(c, 'styles.css') },
      { instruction: '随便修改一个文件，然后 git add . 与 git commit -m "实验提交"', hint: '先制造一个可以后悔的提交', check: (c) => commitCount(c.repo) === 2 },
      { instruction: '执行 git revert HEAD', hint: '观察：历史里新增一个反向提交，原提交还在——不是删除，是抵消', check: (c) => commitCount(c.repo) === 3 && Object.values(c.repo.commits).some((x) => x.message.startsWith('Revert')) },
      { instruction: '执行 git reset --hard HEAD~1', hint: '观察：指针回退，被挤出的提交变成虚影；三个区域一起回退', check: (c) => c.repo.ghosts.length >= 1 },
    ],
  },
  {
    id: 'lesson-06',
    title: '实验 06 · 换地基（Rebase）',
    goal: '看懂 rebase 如何把提交逐个「重放」到新地基上',
    setup: [
      'git init', 'git add .', 'git commit -m "Initial commit"',
      'git switch -c feature/complete-all',
      { edit: 'index.html', find: ADD_BTN_LINE, replace: [ADD_BTN_LINE, '      <button id="complete-btn">全部完成</button>'] },
      'git add .', 'git commit -m "添加全部完成按钮"',
      'git switch master',
      { edit: 'README.md', find: '- 具体内容待补充', replace: ['- 支持截止时间提醒', '- 支持按截止时间排序', '- 具体内容待补充'] },
      'git add .', 'git commit -m "更新 README 功能列表"',
    ],
    steps: [
      { instruction: '执行 git switch feature/complete-all', hint: '这条分支从旧提交岔出，落后 master 一个提交', check: (c) => c.wt.head.branch === 'feature/complete-all' },
      { instruction: '执行 git rebase master', hint: '观察：功能分支的提交被重放到 master 最新提交之后（旧提交变虚影）', check: (c) => { const b = c.repo.branches['feature/complete-all']; return !c.wt.rebaseState && !!b?.commitId && c.repo.commits[b.commitId].parents[0] === c.repo.branches['master']?.commitId; } },
      { instruction: '执行 git switch master，再执行 git merge feature/complete-all', hint: '换好地基后，合并就是一次 Fast-forward', check: (c) => c.repo.branches['master']?.commitId === c.repo.branches['feature/complete-all']?.commitId && commitCount(c.repo) === 3 },
    ],
  },
  {
    id: 'lesson-07',
    title: '实验 07 · 临时收起（Stash）',
    goal: '半成品代码未提交就要切分支？用 stash',
    setup: [
      'git init', 'git add .', 'git commit -m "Initial commit"',
      'git switch -c feature/export',
      { edit: 'app.js', find: 'function render() {', replace: ['function clearCompleted() {', '  // TODO: 函数写了一半…', '}', '', 'function render() {'] },
    ],
    steps: [
      { instruction: '先试一下 git switch master——注意它会被拒绝', hint: '写了一半的改动没提交，Git 不敢覆盖它，于是停下来让你决定', check: (c) => c.lastCommand === 'switch' && c.wt.head.branch === 'feature/export' },
      { instruction: '执行 git stash 把改动收起来', hint: '观察：工作区变干净，右侧 Stash 面板多了一条 WIP 记录', check: (c) => c.repo.stashes.length === 1 && sameAsHead(c, 'app.js') },
      { instruction: '执行 git switch master（这次能切过去了）', hint: '工作区干净，切换不再有障碍', check: (c) => c.wt.head.branch === 'master' },
      { instruction: '执行 git switch feature/export，再执行 git stash pop', hint: '观察：半成品从 Stash 弹回工作区，接着写就行', check: (c) => c.repo.stashes.length === 0 && (c.wt.workingFiles['app.js'] ?? []).some((l) => l.includes('clearCompleted')) },
    ],
  },
  {
    id: 'lesson-08',
    title: '实验 08 · 一库多目录（Worktree）',
    goal: '多个目录并行开发，共享同一份提交历史',
    setup: ['git init', 'git add .', 'git commit -m "Initial commit"'],
    steps: [
      { instruction: '执行 git worktree add ../mark-todo-stats -b feature/stats master', hint: '观察：多出一个目录标签；它有独立的工作区+暂存区，共用提交历史', check: (c) => c.repo.worktrees.length === 2 },
      { instruction: '点击顶部的「mark-todo-stats」标签切换到新目录', hint: '之后命令都在新目录里执行', check: (c) => c.repo.activeWorktreeId !== 'wt-main' },
      { instruction: '修改 index.html（加个统计面板）并 git add . 与 git commit -m "添加统计面板"', hint: '提交记进共享的提交历史', check: (c) => commitCount(c.repo) === 2 && c.repo.activeWorktreeId !== 'wt-main' },
      { instruction: '点回「mark-todo」标签，执行 git merge feature/stats', hint: '观察：合并后删除 worktree，提交也不会丢', check: (c) => c.repo.branches['master']?.commitId === c.repo.branches['feature/stats']?.commitId && c.repo.activeWorktreeId === 'wt-main' },
    ],
  },
  {
    id: 'lesson-09',
    title: '实验 09 · 推上远程（GitHub）',
    goal: '把整个提交历史备份到远程仓库',
    setup: ['git init', 'git add .', 'git commit -m "Initial commit"'],
    steps: [
      { instruction: '执行 git remote add origin git@github.com:mark/mark-todo.git', hint: '远程是模拟的，用于演示本地↔远程的同步关系', check: (c) => !!c.repo.remote },
      { instruction: '执行 git push -u origin master', hint: '观察：提交跨过分隔线飞到 Remote 图谱；-u 绑定本地与远程分支', check: (c) => c.repo.remote?.branches['master'] === c.repo.branches['master']?.commitId },
      { instruction: '再修改一个文件并 git add . 与 git commit -m "更新"', hint: '本地领先远程一个提交，状态栏会提示 ahead', check: (c) => commitCount(c.repo) === 2 },
      { instruction: '执行 git push 完成同步', hint: '日常流程：add → commit → push，远程始终有最新备份', check: (c) => c.repo.remote?.branches['master'] === c.repo.branches['master']?.commitId },
    ],
  },
];

// ---------- 检查辅助 ----------

function sameAsHead(c: LessonContext, path: string): boolean {
  const head = c.wt.head.branch ? c.repo.commits[c.repo.branches[c.wt.head.branch]?.commitId ?? ''] : null;
  const headLines = head?.tree[path];
  const workLines = c.wt.workingFiles[path];
  if (!headLines && !workLines) return true;
  if (!headLines || !workLines || headLines.length !== workLines.length) return false;
  return headLines.every((l, i) => l === workLines[i]);
}

function sameAsHeadIndex(c: LessonContext, path: string): boolean {
  const head = c.wt.head.branch ? c.repo.commits[c.repo.branches[c.wt.head.branch]?.commitId ?? ''] : null;
  const headLines = head?.tree[path];
  const idxLines = c.wt.index[path];
  if (!headLines && !idxLines) return true;
  if (!headLines || !idxLines || headLines.length !== idxLines.length) return false;
  return headLines.every((l, i) => l === idxLines[i]);
}

export { cleanWork };
