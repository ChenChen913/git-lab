# PRD — Git Visual Lab（Git 可视化交互实验室）

> 知识来源：本项目根目录下的两份 Markdown——`git+github教程.md`（视频转稿）与 `Git与GitHub入门教程.md`（整理后的教程总结）；UI 与视觉的硬性要求来自 `../UI 设计.md`（工程化落地为 [UI-DESIGN-SPEC.md](./UI-DESIGN-SPEC.md)）。本 PRD 的全部教学范围以这些文件为准。
>
> 代码仓库：https://github.com/ChenChen913/git-lab （开发过程中持续推送）

## 1. 项目定位

不是一个 Git 教程阅读网站，也不是命令罗列，而是一个：

> **Git Playground —— 用户输入命令 → Mini Git 引擎改变仓库状态 → UI 捕捉状态变化 → 动画展示变化 → 用户理解 Git 到底做了什么。**

核心交互闭环：

```text
用户输入 Git 命令 → Command Parser → Git Simulation Engine
→ Repository State 变化 → Before/After Diff → Animation Operations
→ 动画展示 → 用户观察并理解
```

要解决的核心问题：**让用户"看见" Git 的状态如何变化**，而不是"做一个能执行 Git 命令的网站"。

## 2. 目标用户与场景

- 刚看完教程的新手：需要一个可以随便试、改坏了能重来的"实验室"。
- 教学者：需要把"工作区/暂存区/提交历史""分支是指针不是复制""rebase 是换地基"这类抽象概念演示出来的工具。

## 3. 教学范围（严格来自两份 Markdown）

| 主题 | 覆盖内容 |
| --- | --- |
| 三区模型 | 工作区 / 暂存区（index）/ 提交历史；stage、unstage、untracked 术语 |
| 存档 | `init`、`status`、`add`（单文件/多点/`.`）、`commit -m`、配置 user.name/email |
| 查看 | `log`（含 `--oneline`）、`diff`（+/− 行）、status 提示语 |
| 忽略 | `.gitignore`（含"文件仍在磁盘、规则要提交"两个要点） |
| 回滚 | `restore`、`restore --staged`、`reset --hard/--mixed/--soft`（三模式区域差异表）、`revert`（新 commit 抵消，历史保留） |
| 分支 | 分支=贴在 commit 上的标签；master/main 主分支应稳定；`branch`、`switch`、`switch -c`、`checkout -b`（旧写法说明） |
| 合并 | 合并方向是"合入当前分支"；fast-forward vs merge commit（两个 parents） |
| 冲突 | 为什么冲突（同位置两份内容）、`<<<<<<< HEAD` 标记、解决四法、`git add`+`git commit` 完成合并、`merge --abort` |
| Rebase | 换地基；commit 逐个重放；冲突后 `git add` + `git rebase --continue`（不是 commit）；rebase 后合并即 fast-forward |
| Stash | 未提交改动临时收起（工作区+暂存区）、切分支不被阻塞、`stash pop` 取回；index=WIP 术语 |
| Worktree | 多个 worktree：各自独立的工作区+暂存区，共享同一份提交历史；`worktree add/list/remove`；不能直接删文件夹 |
| 远程 | Git=本地软件、GitHub=远程网站；SSH 公私钥概念（仅概念展示，不做真实网络）；`remote add`、`push -u`、`push`、`pull`、`clone`（整体历史上传/拉回） |
| 日常闭环 | 改代码 → `add` → `commit` → `push`；ahead / up to date 状态提示 |

## 4. 明确不做（防止功能堆砌）

detached HEAD 的完整交互、reflog、cherry-pick、tag、submodule、交互式 rebase、真实 GitHub API/网络请求、多远程、钩子。SSH Key 只做概念示意，不模拟生成流程。

## 5. 阶段划分（Phase 0–7）

| Phase | 内容 | 退出条件 |
| --- | --- | --- |
| 0 | 设计文档（本目录六份） | 自检通过 |
| 1 | Git Core MVP：init/status/add/commit/log/diff + 状态模型 + 终端 + 三区面板 + Commit Graph + 基础动画 | 验收 A 组通过 |
| 2 | Branch & Merge | 验收 Branch/Merge 组通过（fast-forward 不产生 merge commit；merge commit 有两个 parents） |
| 3 | Conflict | 冲突全流程走通（创建两分支→改同一文件→merge→冲突→查看双方→解决→add→commit） |
| 4 | Rollback / Rebase / Stash | 每个命令能可视化其与其他命令的区别 |
| 5 | Worktree / Remote | worktree 独立 WT+暂存区、共享历史可演示；push/pull/clone 模拟 |
| 6 | Tutorial 引导模式 | 至少 6 个实验，含命令校验、进度、成功反馈 |
| 7 | Polish 与最终验收 | ACCEPTANCE.md 全部通过 |

## 6. MVP 边界

MVP = Phase 1。每个 Phase 完成后必须：运行项目、检查状态一致性（终端/文件区/三区面板/Graph/HEAD 全一致）、执行该阶段验收、修复后再进入下一阶段。

## 7. 体验目标

打开项目后，无需阅读大量说明即可理解界面中哪里是 Working Tree、哪里是 Staging Area、哪里是 Commit History、HEAD/分支在哪、终端在哪。输入 `git add` / `git commit` / `git switch` / `git merge` 能直接观察内部状态变化——"我不是在看 Git 教程，而是在操作一个 Git 实验室。"

视觉基调：现代、干净、专业，明亮为主、留白充分、信息层级清晰；Git Graph 是视觉中心；动画克制、有方向性和因果性。
