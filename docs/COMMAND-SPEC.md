# COMMAND-SPEC — 命令规格与知识点映射

## 1. 知识点 → 命令 → 状态变化 → UI → 动画 映射表（源自两份 Markdown）

| 教程知识点 | 命令 | Repository State 变化 | UI 表现 | 动画表现 |
| --- | --- | --- | --- | --- |
| 三区模型 / `git init` 创建 .git | `git init` | initialized=true，默认分支+HEAD 出现 | 三区面板与 Graph 区域从"未初始化"点亮 | 面板依次浮现，分支标签出现 |
| untracked / git 发现但未跟踪 | `git status` | 无变化 | 文件列表按状态分组着色 | — |
| 挑选内容进暂存区 | `git add` | workingFiles 快照复制进 index | 文件出现在 Staging 面板，状态徽标变化 | 芯片沿 工作区→暂存区 方向移动，箭头脉冲 |
| commit=打包暂存区成版本；分支指针前移 | `git commit -m` | 新 commit 入历史，分支指向它，index 对齐 | Graph 新节点，分支标签前移 | 暂存芯片聚合飞入新节点，节点弹入，指针滑动 |
| 提交人信息 | `git config` | config 更新 | log/commit 显示作者 | — |
| 历史查看 / 身份证号般的 id | `git log [--oneline]` | 无变化 | 终端输出彩色历史 | — |
| 看具体改动（+/−） | `git diff [--staged]` | 无变化 | Diff 视图逐文件 +/- 行 | — |
| 忽略规则随项目走 | `.gitignore`（文件，非命令） | 忽略列表持久化 | 忽略文件灰显不进 untracked | — |
| 撤销工作区改动 | `git restore [.]` | workingFiles ← HEAD | 文件徽标回到 clean，Diff 清空 | 芯片闪烁回落，方向箭头反向 |
| unstage（只动 Git 记录不动文件） | `git restore --staged [.]` | index ← HEAD | Staging 面板移除，工作区文件原样 | 芯片从暂存区滑回，箭头反向 |
| reset 三模式差异 | `git reset [--hard/--mixed/--soft] HEAD~n` | 分支指针回退；hard 动三区 / mixed 动前两区保留工作区 / soft 只动历史；被挤出 commit → ghost | Graph 指针回滑 + ghost 节点；文件区按模式变化 | 指针 spring 回移，ghost 半透明保留，丢弃芯片抖动消失 |
| revert=新 commit 抵消（历史保留） | `git revert HEAD` | 新反向 commit | Graph 新节点且原节点保留高亮 | 反向连线闪现，新节点弹入 |
| 分支=标签，不是复制代码 | `git branch <name>` | branches 增加引用，树/文件不变 | Graph 出现新标签贴在同一节点 | 标签在节点旁生成 |
| 创建即切换 | `git switch -c` | 同上 + HEAD 移到新分支 | HEAD 徽标移动 | HEAD 弹跳换位 |
| 切换分支 | `git switch` | HEAD/工作区/暂存区换成目标 tree（未提交改动会被覆盖时拒绝） | 文件区整体切换内容 | 文件芯片交叉淡入，HEAD 移动 |
| 合并方向=合入当前分支；ff vs merge commit | `git merge <b>` | ff：指针前移；分叉：新 commit 两个 parents；冲突 → mergeState | Graph：主线延长 / 双线汇聚成菱形；冲突时冲突面板弹出 | ff 指针滑动；merge 双边曲线汇入新节点 |
| 为什么冲突 / 标记三行 | `git merge`（冲突） | mergeState 记录 ours/theirs/base | 冲突视图左右对照 ours vs theirs + 标记片段 | 双色块对撞效果 |
| 解决→add→commit 完成 | `git add`+`git commit` | 清 mergeState，生成 merge commit | 冲突面板关闭，Graph 出现双亲节点 | 冲突块收拢进新 commit |
| 放弃合并 | `git merge --abort` | 状态与文件回滚到合并前 | 一切复原 | 复位过渡 |
| 换地基 / commit 逐个重放 | `git rebase <b>` + `--continue` | 分支 commit 逐个重建在新地基上，原 commit → ghost；分支指向新链尾 | Graph 旧链变幽灵、新链弹入；指针最终滑动 | 每个重放：旧节点→虚线→新节点 D→D′ |
| 收起未提交改动 | `git stash` | 差异快照进 stash，WT/index 重置 | Stash 面板新增条目，文件区变干净 | 芯片折入 stash 卡片 |
| 取回 | `git stash pop` | 快照写回工作区 | Stash 条目消失，文件区恢复改动 | 芯片从 stash 弹回 |
| 一库多目录：独立 WT+暂存区，共享历史 | `git worktree add/list/remove` | worktrees 增删（共享 commits/branches） | 顶部 worktree 标签页 + Graph 中各 worktree 的 HEAD 标注；共享历史区高亮 | 新目录卡片生长动画 |
| 本地软件 vs 远程网站 | `git remote add` | remote 出现 | 右侧出现 Remote 分区与分隔线 | 分隔线展开 |
| 整体历史上传 | `git push [-u]` | remote.branches ← 本地分支 | Remote 图谱补齐节点；状态栏 ahead→同步 | 飞点跨线，远端节点逐个点亮 |
| 同步 | `git pull` | ff 或自动 merge | 双侧图谱对齐 | 反向飞点 |
| 整体历史拉回 | `git clone` | 以 remote 重建本地 | 双侧完全一致 | 整组节点落下 |

## 2. 命令规格

通用约定：

- 输出 kinds：`info`（默认白）、`muted`（灰）、`success`（绿）、`error`（红，前缀按真实 git：`fatal:`/`error:`）、`diff-add`（绿 +）、`diff-del`（红 −）、`hint`（蓝，提示下一步）。
- commit-ish 解析：`HEAD`、`HEAD~n`、分支名、hash 前缀；解析失败报 `fatal: ambiguous argument '...'`。
- 未初始化时执行任何 git 命令：`fatal: not a git repository (or any of the parent directories): .git`。

| 命令 | 行为 | 状态变化 | 关键输出 | 错误 | ops |
| --- | --- | --- | --- | --- | --- |
| `git init` | 初始化仓库 | initialized、默认分支 master、HEAD | `Initialized empty Git repository` | 已初始化→提示已存在 | `REPO_INITIALIZED` |
| `git status` | 状态报告 | 无 | 分支行 + 三分组 + ahead/up to date | — | — |
| `git add <p>`/`.`/`-A` | WT→index | index 更新 | 无输出（成功静默） | `fatal: pathspec 'x' did not match any files` | `FILE_STAGED*` |
| `git commit -m "msg"` | 打包 index | 新 commit、分支前移；mergeState 存在时生成双亲 commit 并清除 | `[main (root-commit) c1] msg` + 文件数 | 缺 -m；无暂存改动→`nothing to commit`；冲突未解决 | `COMMIT_CREATED`、`BRANCH_MOVED` |
| `git log [--oneline]` | 从 HEAD 遍历 parents | 无 | 逐条 hash/作者/时间/说明，`(HEAD -> main)` 标注 | — | — |
| `git diff [--staged]` | WT vs HEAD（或 index vs HEAD） | 无 | 文件级 +/- 行 | — | `HIGHLIGHT` |
| `git config user.name/email <v>`（含 --global） | 写配置 | config | 静默 | — | — |
| `git branch` / `<n>` / `-d <n>` | 列出/创建/删除 | branches 变化 | 列表带 `*` 与 `+`（其他 worktree 占用） | 重复创建；删当前分支；无 commit 时创建 | `BRANCH_CREATED/DELETED` |
| `git switch <b>` / `-c <b>` / `git checkout -b <b>` | 切换/创建并切换 | head、WT、index ← 目标 tree（untracked 保留） | `Switched to branch 'x'` | 本地改动会被覆盖→`error: Your local changes ... would be overwritten`；分支不存在 | `HEAD_MOVED`、`BRANCH_CREATED` |
| `git merge <b>` | 三方合并 | ff 前移 / merge commit / mergeState | `Fast-forward` / `Merge made by the 'ort' strategy` / `CONFLICT ... Automatic merge failed` | 无该分支；已最新→`Already up to date.` | `FAST_FORWARD` / `MERGE_COMMIT_CREATED` / `CONFLICT_CREATED` |
| `git merge --abort` | 放弃合并 | 全部回滚 | 静默 | 无进行中合并 | `MERGE_ABORTED` |
| `git restore <p>`/`.` | WT ← HEAD | workingFiles | 静默 | 路径不匹配 | `FILE_RESTORED*` |
| `git restore --staged <p>`/`.` | index ← HEAD | index | 静默 | 同上 | `FILE_UNSTAGED*` |
| `git reset [--mode] <commit-ish>` | 三模式回退 | 见模型文档 | `HEAD is now at c2 ...` | 无改动/无法解析时提示 | `BRANCH_MOVED(mode)` + 文件 ops + ghost |
| `git revert <commit-ish>` | 反向 commit | 新 commit，tree=目标 parent tree | `[main c4] Revert "msg"` | revert merge commit 不支持 | `COMMIT_CREATED` + `REVERT_HIGHLIGHT` |
| `git rebase <b>` / `--continue` / `--abort` | 换地基重放 | 逐 commit 重建；冲突挂起 | `Successfully rebased` / `CONFLICT` / `Current branch ... up to date` | 冲突时 `git commit` 无效→提示用 `--continue` | `COMMIT_REPLAYED*` + ghost |
| `git stash` / `pop` / `list` | 收起/取回/列表 | stashes 变化；WT/index ↔ HEAD | `Saved working directory ... WIP on main: c3 msg` | 无改动→`No local changes to save`；pop 空栈 | `STASH_CREATED` / `STASH_POPPED` |
| `git worktree add <path> [-b <nb>] [<base>]` / `list` / `remove <path>` | 多目录 | worktrees 增删 | `Preparing worktree (checking out 'x')` | 分支已被其他 worktree 占用；删 main；路径已存在 | `WORKTREE_ADDED/REMOVED` |
| `git remote add origin <url>` | 登记远程 | remote | 静默 | 重复添加 | `REMOTE_ADDED` |
| `git push [-u origin <b>]` | 上传分支 | remote.branches 更新 | `Writing objects: 100%` / `branch 'x' set up to track 'origin/x'` | 无 remote；`Everything up-to-date` | `PUSH_SYNCED` |
| `git pull` | 拉取合并 | ff/merge | `Fast-forward` / `Already up to date` | 无 remote；冲突简化报错 | `PULL_SYNCED` |
| `git clone <url> [dir]` | 以远程重建本地 | 仓库/WT 重建 | `Cloning into 'x'... done.` | 无 remote 时提示先用 remote add 模拟 | `CLONED` |
| `clear` / `help` | 清屏/帮助 | — | — | — | — |

## 3. 冲突判定细节

merge 对每个 file（base=merge-base tree，ours=当前 HEAD tree，theirs=合入分支 tree）：

1. 双方均未改动 → 保留；2. 单边改动 → 取该边；3. 双边相同改动 → 保留；4. 双边不同改动 → 冲突：`ours`/`theirs`/`base` 记入 mergeState，工作区写入带标记文本（`<<<<<<< HEAD` / `=======` / `>>>>>>> <branch>`）。

解决方式：取当前分支 / 取合入分支 / 都保留（ours 行 + theirs 行顺序合并）/ 手动编辑（textarea）。解决后文件进 index，全部冲突文件处理完 → `git commit` 生成双亲 commit。

rebase 冲突复用同一判定（base=被重放 commit 的 parent tree，ours=新地基 HEAD，theirs=被重放 commit tree），解决后 `git add` + `git rebase --continue`。
