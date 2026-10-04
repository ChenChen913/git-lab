// 引擎冒烟测试：在 Node 中跑通全部核心 Git 流程（对应 ACCEPTANCE.md 的引擎侧验收）
import { executeCommand } from '../git-engine/engine';
import { initialRepo } from '../git-engine/repository';
import { initialWorkFiles } from '../sample/project';
import type { Repository } from '../types';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function fresh(): Repository {
  const r = initialRepo();
  r.worktrees[0].workingFiles = initialWorkFiles();
  return r;
}

/** 执行命令；若命令既没有产生新状态又输出 error，视为意外失败 */
function ok(repo: Repository, cmd: string): Repository {
  const r = executeCommand(repo, cmd);
  const errs = r.output.filter((o) => o.kind === 'error').map((o) => o.text).join(' | ');
  if (errs && !r.repo) throw new Error(`意外失败: ${cmd} → ${errs}`);
  return r.repo ?? repo;
}

/** 执行命令并断言失败（状态必须不变） */
function expectFail(repo: Repository, cmd: string, contains?: string): Repository {
  const r = executeCommand(repo, cmd);
  const hasErr = r.output.some((o) => o.kind === 'error');
  assert(hasErr, `应当报错: ${cmd}`);
  assert(r.repo === null, `报错时状态不得变化: ${cmd}`);
  if (contains) assert(r.output.some((o) => o.text.includes(contains)), `报错信息含 "${contains}": ${cmd}`);
  return repo;
}

function edit(repo: Repository, path: string, find: string, replace: string[]): Repository {
  const next = structuredClone(repo);
  const lines = next.worktrees[0].workingFiles[path];
  const i = lines.indexOf(find);
  if (i === -1) throw new Error(`edit 找不到行: ${find}`);
  lines.splice(i, 1, ...replace);
  return next;
}

const tip = (r: Repository, b: string) => r.branches[b]?.commitId ?? null;
const count = (r: Repository) => Object.keys(r.commits).length;

// ===== A. 基础流程 =====
console.log('A. 基础流程');
let r = fresh();
assert(!r.initialized, '初始未初始化');
r = ok(r, 'git init');
assert(r.initialized && r.branches['master'] && r.worktrees[0].head.branch === 'master', 'init 后仓库/分支/HEAD 就位');

r = ok(r, 'git status');

r = ok(r, 'git add index.html');
assert(!!r.worktrees[0].index['index.html'], 'add 后进入暂存区');
assert(!r.worktrees[0].index['README.md'], '未 add 的文件不进暂存区');

r = ok(r, 'git commit -m "Add homepage"');
assert(count(r) === 1 && tip(r, 'master') === 'c1', 'commit 创建 c1 且 master 指向它');

// add 不存在的文件必须失败且状态不变
r = expectFail(r, 'git add nonexistent.txt', 'did not match any files');
r = expectFail(r, 'git switch nonexistent', 'invalid reference');
{
  const res = executeCommand(r, 'git commit -m "空提交"');
  assert(
    !res.repo && res.output.some((o) => o.text.includes('nothing to commit') || o.text.includes('no changes added')),
    '无暂存改动的提交被拒绝且状态不变',
  );
}

// 修改 README → add . → commit
r = edit(r, 'README.md', '- 具体内容待补充', ['- 支持截止时间提醒', '- 具体内容待补充']);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "补充 README"');
assert(count(r) === 2 && tip(r, 'master') === 'c2', '第二次提交 c2');

// ===== B. 分支 =====
console.log('B. 分支');
r = ok(r, 'git branch feature/due-date');
assert(tip(r, 'feature/due-date') === 'c2', '新分支贴在 c2 上');
r = ok(r, 'git switch feature/due-date');
assert(r.worktrees[0].head.branch === 'feature/due-date', 'switch 后 HEAD 移到新分支');
r = edit(r, 'app.js', 'function render() {', ['function withDueDate() {}', '', 'function render() {']);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "添加截止时间"');
assert(count(r) === 3 && tip(r, 'master') === 'c2', '提交只落在 feature 分支，master 不动');

r = ok(r, 'git switch master');
assert(!(r.worktrees[0].workingFiles['app.js'] ?? []).some((l) => l.includes('withDueDate')), '切回 master 后文件恢复');

// 未提交改动切分支被拒绝
r = edit(r, 'app.js', 'const todos = [];', ['const todos = [];', '// 半成品']);
r = expectFail(r, 'git switch feature/due-date', 'would be overwritten');
r = ok(r, 'git stash');
assert(!(r.worktrees[0].workingFiles['app.js'] ?? []).includes('// 半成品'), 'stash 后工作区干净');
assert(r.stashes.length === 1, 'stash 条目记录');
r = ok(r, 'git switch feature/due-date');
r = ok(r, 'git switch master');
r = ok(r, 'git stash pop');
assert((r.worktrees[0].workingFiles['app.js'] ?? []).includes('// 半成品'), 'pop 后改动回到工作区');
r = ok(r, 'git restore app.js');

// ===== C. 合并：ff 与 merge commit =====
console.log('C. 合并');
// fast-forward：master 直接前移
r = ok(r, 'git merge feature/due-date');
assert(tip(r, 'master') === 'c3', 'ff 后 master 指向 c3');
assert(count(r) === 3, 'ff 不产生新提交');
assert(!Object.values(r.commits).some((c) => c.merge), '无 merge commit');

// 分叉 → 冲突
r = ok(r, 'git switch -c feature/complete');
r = edit(r, 'index.html', '      <button type="submit" id="add-btn">添加</button>', [
  '      <button type="submit" id="add-btn">添加</button>',
  '      <button id="complete-btn">全部完成</button>',
]);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "添加全部完成按钮"');
r = ok(r, 'git switch master');
r = edit(r, 'index.html', '      <button type="submit" id="add-btn">添加</button>', [
  '      <button type="submit" id="add-btn">添加</button>',
  '      <button id="sort-btn">排序</button>',
]);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "添加排序按钮"');
assert(count(r) === 5, '两条分支各有一个提交');

r = ok(r, 'git merge feature/complete');
assert(!!r.worktrees[0].mergeState, '分叉且双边改动 → 冲突');
assert(r.worktrees[0].workingFiles['index.html'].some((l) => l.startsWith('<<<<<<<')), '工作区含冲突标记');

// abort
r = ok(r, 'git merge --abort');
assert(!r.worktrees[0].mergeState, 'abort 后合并状态清除');
assert(!r.worktrees[0].workingFiles['index.html'].some((l) => l.startsWith('<<<<<<<')), 'abort 后标记消失');

// 再次合并并解决（两个都保留）
r = ok(r, 'git merge feature/complete');
{
  const next = structuredClone(r);
  next.worktrees[0].workingFiles['index.html'] = next.worktrees[0].workingFiles['index.html'].filter(
    (l) => !l.startsWith('<<<<<<<') && l !== '=======' && !l.startsWith('>>>>>>>'),
  );
  r = next;
}
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "同时保留两个按钮"');
assert(!r.worktrees[0].mergeState, 'commit 后合并状态清除');
const mergeCommit = Object.values(r.commits).find((c) => c.parents.length === 2);
assert(!!mergeCommit, '产生了双亲合并提交');
assert(tip(r, 'master') === mergeCommit!.id, 'master 指向合并提交');
r = ok(r, 'git branch -d feature/complete');
assert(!r.branches['feature/complete'], '分支已删除');
r = expectFail(r, 'git branch -d master', 'Cannot delete');

// ===== D. revert / reset =====
console.log('D. 回滚');
r = expectFail(r, 'git revert HEAD', '不支持合并提交');
r = edit(r, 'README.md', '- 支持截止时间提醒', ['- 支持截止时间提醒 ✓']);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "D 提交"');
const dCommit = tip(r, 'master')!;
r = ok(r, 'git revert HEAD');
const revertCommit = r.commits[tip(r, 'master')!];
assert(revertCommit.message.startsWith('Revert'), 'revert 生成 Revert 提交');
assert(count(r) === 8, 'revert 后共 8 个提交（原提交保留）');
r = ok(r, 'git reset --hard HEAD~1');
assert(tip(r, 'master') === dCommit, 'reset --hard 回到 D 提交');
assert(r.ghosts.length >= 1, '被挤出的提交成为虚影');
r = ok(r, 'git reset --soft HEAD~1');
assert(tip(r, 'master') === mergeCommit!.id, 'reset --soft 回到合并提交');
assert((r.worktrees[0].workingFiles['index.html'] ?? []).some((l) => l.includes('sort-btn')), 'soft：工作区保留改动');
r = ok(r, 'git commit -m "再次提交"');
assert(count(r) === 9, '重新提交产生新提交');

// restore / restore --staged
r = edit(r, 'README.md', '- 支持截止时间提醒 ✓', ['- 支持截止时间提醒（改动）']);
r = ok(r, 'git restore README.md');
assert(!(r.worktrees[0].workingFiles['README.md'] ?? []).some((l) => l.includes('（改动）')), 'restore 撤销工作区改动');

// ===== E. rebase =====
console.log('E. rebase');
r = ok(r, 'git switch -c feature/rebase-demo');
r = edit(r, 'app.js', 'const todos = [];', ['const todos = [];', '// feature 改动']);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "feature 提交"');
const featureTipBefore = tip(r, 'feature/rebase-demo')!;
r = ok(r, 'git switch master');
r = edit(r, 'styles.css', 'body { font-family: sans-serif; background: #f6f8fb; }', ['body { font-family: sans-serif; background: #eef2ff; }']);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "master 提交"');
const masterTipBefore = tip(r, 'master')!;
r = ok(r, 'git switch feature/rebase-demo');
r = ok(r, 'git rebase master');
assert(tip(r, 'feature/rebase-demo') !== featureTipBefore, 'rebase 重写了分支提交');
assert(r.commits[tip(r, 'feature/rebase-demo')!].parents[0] === masterTipBefore, '新提交接在 master 最新提交后');
assert(r.ghosts.some((g) => g.id === featureTipBefore), '旧提交成为虚影');
r = ok(r, 'git switch master');
const beforeMerge = count(r);
r = ok(r, 'git merge feature/rebase-demo');
assert(tip(r, 'master') === tip(r, 'feature/rebase-demo') && count(r) === beforeMerge, 'rebase 后合并为 fast-forward');

// rebase 冲突 → continue
r = ok(r, 'git switch -c feature/conflict-rebase');
r = edit(r, 'index.html', '      <button type="submit" id="add-btn">添加</button>', [
  '      <button type="submit" id="add-btn">添加</button>',
  '      <button id="export-btn">导出</button>',
]);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "feature 冲突提交"');
r = ok(r, 'git switch master');
r = edit(r, 'index.html', '      <button type="submit" id="add-btn">添加</button>', [
  '      <button type="submit" id="add-btn">添加</button>',
  '      <button id="stats-btn">统计</button>',
]);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "master 冲突提交"');
r = ok(r, 'git switch feature/conflict-rebase');
r = ok(r, 'git rebase master');
assert(!!r.worktrees[0].rebaseState?.conflicts['index.html'], 'rebase 撞出冲突');
r = expectFail(r, 'git commit -m "x"', 'rebase');
{
  const next = structuredClone(r);
  next.worktrees[0].workingFiles['index.html'] = next.worktrees[0].workingFiles['index.html'].filter(
    (l) => !l.startsWith('<<<<<<<') && l !== '=======' && !l.startsWith('>>>>>>>'),
  );
  r = next;
}
r = ok(r, 'git add .');
r = ok(r, 'git rebase --continue');
assert(!r.worktrees[0].rebaseState, 'continue 后变基完成');

// ===== F. worktree =====
console.log('F. worktree');
r = ok(r, 'git switch master');
r = ok(r, 'git branch -d feature/conflict-rebase');
const wtCountBefore = r.worktrees.length;
r = ok(r, 'git worktree add ../mark-todo-stats -b feature/stats master');
assert(r.worktrees.length === wtCountBefore + 1, 'worktree 创建');
assert(tip(r, 'feature/stats') === tip(r, 'master'), '新分支基于 master');
r = expectFail(r, 'git worktree add ../mark-todo-stats2 feature/stats', 'already checked out');
{
  const next = structuredClone(r);
  const id = next.worktrees[next.worktrees.length - 1].id;
  next.activeWorktreeId = id;
  next.worktrees[next.worktrees.length - 1].workingFiles['index.html'] = [
    ...next.worktrees[next.worktrees.length - 1].workingFiles['index.html'],
    '<!-- stats panel -->',
  ];
  r = next;
}
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "添加统计面板"');
assert(tip(r, 'feature/stats') !== tip(r, 'master'), '新目录里的提交落在 feature/stats');
{
  const next = structuredClone(r);
  next.activeWorktreeId = 'wt-main';
  r = next;
}
r = ok(r, 'git merge feature/stats');
assert(tip(r, 'master') === tip(r, 'feature/stats'), '共享历史：主目录直接合并');
r = ok(r, 'git worktree remove ../mark-todo-stats');
assert(r.worktrees.length === wtCountBefore, 'worktree 删除');
assert(!!r.commits[tip(r, 'feature/stats')!], '删除 worktree 后提交仍在');

// ===== G. 远程 =====
console.log('G. 远程');
r = expectFail(r, 'git push', 'push destination');
r = ok(r, 'git remote add origin git@github.com:mark/mark-todo.git');
assert(!!r.remote, '远程登记');
r = expectFail(r, 'git remote add origin x', 'already exists');
r = ok(r, 'git push -u origin master');
assert(r.remote!.branches['master'] === tip(r, 'master'), 'push 后远程指向本地 tip');
r = ok(r, 'git push');
r = edit(r, 'README.md', '- 支持截止时间提醒 ✓', ['- 支持截止时间提醒（更新）']);
r = ok(r, 'git add .');
r = ok(r, 'git commit -m "更新 README"');
r = ok(r, 'git pull');
assert(r.remote!.branches['master'] !== tip(r, 'master'), '本地领先时 pull 无效果');
r = ok(r, 'git push');
assert(r.remote!.branches['master'] === tip(r, 'master'), '再次 push 同步');
r = ok(r, 'git clone git@github.com:mark/mark-todo.git 马克代办');
assert(tip(r, 'master') === r.remote!.branches['master'], 'clone 重建后与远程一致');

// ===== H. gitignore =====
console.log('H. gitignore');
{
  const next = structuredClone(r);
  next.worktrees[0].workingFiles['notes.txt'] = ['学习进度：50%'];
  next.worktrees[0].workingFiles['.gitignore'] = ['notes.txt', '.DS_Store'];
  r = next;
}
{
  const st = executeCommand(r, 'git status');
  assert(st.output.some((o) => o.kind === 'muted' && o.text.includes('Ignored')), 'notes.txt 出现在忽略区');
}
r = ok(r, 'git add .');
assert(!r.worktrees[0].index['notes.txt'], 'add . 不加入被忽略文件');
assert(!!r.worktrees[0].index['.gitignore'], '.gitignore 本身被加入');
r = ok(r, 'git commit -m "添加 .gitignore"');
r = expectFail(r, 'git add notes.txt', 'ignored');

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed ? 1 : 0);
