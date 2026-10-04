# Git 可视化交互实验室 · 使用手册

> 这份手册教你**怎么使用、怎么玩**这个项目。每一章告诉你：这一章有哪些实验、每个实验练什么、在界面上的哪个位置观察什么现象。配合界面右上角的「引导实验」使用效果最佳。

---

## 0. 界面导览（先花 1 分钟认识屏幕）

打开项目后，屏幕分为五个区域：

| 区域 | 位置 | 作用 |
| --- | --- | --- |
| 文件（Working Directory） | 左侧 | 演示项目「马克代办」的文件。**点击文件即可在编辑器中修改并保存**，相当于在 VS Code 里改代码；「新建」按钮可以创建新文件（例如 `.gitignore`） |
| 三个区域 | 中间上方 | 本项目的核心教具：工作区（深灰卡）→ `git add` → 暂存区（深蓝卡）→ `git commit` → 提交历史（深绿卡）。虚线框表示暂存区和提交历史都住在 `.git` 文件夹里。文件条会在卡片之间**飞行** |
| 提交历史全景（Commit Graph） | 中间下方 | 水平时间线：圆点 = 提交（颜色 = 所属分支），气泡 = 分支名，黄色圆环 = HEAD 当前位置，虚线圆点 = 被 reset/rebase 丢弃的"幽灵"提交 |
| 终端 | 底部 | 输入真实 Git 命令并回车。支持 ↑/↓ 翻历史、快捷命令按钮、彩色输出。**命令失败不会改变任何状态** |
| 右侧面板 | 右侧 | 五个标签页：**实验**（引导教学）、**Diff**（差异查看）、**Stash**（收藏的改动）、**Remote**（本地↔远程同步）、**帮助**（命令速查） |

> 第一次打开会弹出四步引导浮层，看完点「从实验 01 开始」即可。

---

## 第一章 · 入门：把代码存进时间线

**解决一个问题：代码改好了，怎么存档？改坏了怎么退回去？**

### 实验 01 · 第一次存档（对应界面：三区面板 + Graph）

在「引导实验」面板点击「实验 01 · 第一次存档」，然后跟着步骤在终端输入：

```bash
git init                    # 把当前文件夹变成 Git 仓库
git status                  # 看看 Git 发现了什么
git add index.html          # 把 index.html 放进暂存区
git commit -m "Add homepage"  # 创建第一个提交
git log                     # 查看这条提交的完整信息
```

**观察点：**

- `git init` 的瞬间：右侧三个区域面板与提交历史被"点亮"，默认分支 master 出现；
- `git add` 时：文件条从**工作区卡片飞进暂存区卡片**，蓝色箭头闪光——文件没有被移动，只是被"复制登记"进了暂存区；
- `git commit` 时：暂存区内容聚合打包，Graph 上出现第一个圆点，master 标签贴在它上面；
- `git status` 的三种状态：未跟踪（U）、已修改（M）、已暂存（S），与文件列表的徽标一一对应。

### 实验 02 · 日常修改循环

练习真实开发中最高频的节奏：**改代码 → git diff → git add → git commit**。

1. 点击左侧 README.md，随便改一行并保存——文件立刻标为「已修改」；
2. 输入 `git diff`：右侧 Diff 面板与终端同步显示 `+`（新增）和 `-`（删除）的行；
3. `git add README.md`，再看 `git diff --staged`（暂存区 vs 最新提交）；
4. `git commit -m "补充 README"` 完成存档。

**在哪看：** Graph 上多了一个圆点；右侧 Diff 面板有完整的逐行对比。

---

## 第二章 · 分支：一个标签，不是一份拷贝

**解决一个问题：想开发新功能，又不想弄乱能正常用的主分支。**

### 实验 03 · 分支是指针

```bash
git branch feature/due-date      # 只创建，不切换——注意文件区毫无变化！
git branch                       # 查看分支列表（* = 当前所在）
git switch feature/due-date      # 切换过去
# 修改 index.html，然后：
git add . && git commit -m "添加功能"
git switch master                # 切回主分支——新功能消失了？
git merge feature/due-date       # 把分支上的工作合并回来
```

**观察点（本章最重要的一课）：**

- 创建分支后 **Graph 上只是多了一个气泡标签**，贴在同一个圆点上——分支只是"指向某个提交的标签"，不是复制代码；
- 在 feature 分支上提交时，master 标签纹丝不动；切回 master，文件区自动还原；
- `git merge` 后如果 Graph 上**没有产生新圆点**、只是 master 标签"快进"到了分支的位置——这就是 **Fast-forward 合并**（终端会明确告诉你）。

### 自由练习：快进合并 vs 真合并

- **快进（Fast-forward）**：从 master 拉分支 → 在分支上提交 → 切回 master → `git merge`。master 直接前移，**没有新提交**；
- **真合并（Merge Commit）**：拉两个分支各提交几个 commit（master 在此期间也前进）→ 合并第二个分支。Graph 上会出现一个**有两个父提交**的菱形汇合点——两条历史线在这里汇成一条。

---

## 第三章 · 冲突：两个人改了同一个地方

**解决一个问题：为什么会有冲突？冲突了怎么办？**

### 实验 04 · 冲突现场

实验会自动搭好场景（两个分支各在「添加」按钮后面插入了一个不同的按钮），你只需要：

```bash
git merge feature/complete-all   # 触发冲突！
# 在弹出的冲突面板中点击「两个都保留」
git add .
git commit -m "同时保留两个按钮"
```

**观察点：**

- 冲突面板：左边蓝色区是 **HEAD（当前分支）的版本**，右边橙色区是**合入分支的版本**，双方不同的行会高亮并自动滚动到眼前；
- 下方展示 Git 写进文件的 `<<<<<<< HEAD` / `=======` / `>>>>>>>` 三行标记——这就是"冲突现场"；
- 四种解决方式：采用当前分支 / 采用合入分支 / **两个都保留** / 手动编辑；
- 完成合并后看 Graph：出现一个**双亲提交**，两条分支的曲线在这里汇合；
- 后悔了？随时 `git merge --abort` 一键回到合并前。

---

## 第四章 · 后悔药：三种回滚的区别

**解决一个问题：commit 提交错了，怎么撤？**

### 实验 05 · 后悔药

| 命令 | 效果 | 什么时候用 |
| --- | --- | --- |
| `git restore 文件` | 撤销**工作区**的改动（彻底丢弃） | 还没 add，改错了 |
| `git restore --staged 文件` | 把文件从**暂存区**拿回工作区（**文件内容不变**） | add 错了文件 |
| `git revert HEAD` | 新增一个"正好相反"的提交来抵消 | 已经推送、不想破坏历史 |
| `git reset --hard HEAD~1` | 删掉最近一次提交，三个区域全部回退 | 确定不要了（**会连未提交改动一起丢**） |

**观察点（在 Graph 上）：**

- `revert`：历史里**新增**一个 `Revert "..."` 提交，原提交还在；
- `reset --hard`：被挤掉的提交变成**虚线幽灵**留在原地——它去了哪里一目了然；
- `reset --mixed`（默认）：改动回到工作区；`reset --soft`：改动还留在暂存区。三种模式的差异在文件区直接可见。

---

## 第五章 · Rebase：给分支换个地基

**解决一个问题：功能做了一半，master 上已经有了别人的新代码，怎么办？**

### 实验 06 · 换地基

```bash
git switch feature/complete-all
git rebase master                # 把分支的提交逐个"重放"到 master 最新位置
# 如果撞出冲突：解决 → git add . → git rebase --continue（注意：不是 git commit！）
git switch master
git merge feature/complete-all   # 这次合并是 Fast-forward，干净利落
```

**观察点：**

- rebase 时 Graph 上旧提交变幽灵，新提交（D → D′）在 master 最新位置之后**逐个弹出来**——这就是"重新应用"；
- rebase 完成后再合并，master 只需直接前移，历史保持一条直线。

> 为什么推荐"时不时 rebase 一下"？在实验里故意让两个分支改同一行，你会看到 rebase 中途的冲突——冲突在改动还少的时候当场解决，比最后一刻爆发好得多。

---

## 第六章 · Stash：改到一半，先收起来

**解决一个问题：代码写了一半没提交，突然要切分支修 bug？**

### 实验 07 · 临时收起

```bash
# 实验场景：你在 feature/export 上有一段写了一半的函数
git switch master        # ← 会被拒绝！Git 不敢覆盖你未提交的改动
git stash                # 把改动收进 stash（工作区立刻变干净）
git switch master        # 现在能切了
git switch feature/export
git stash pop            # 把改动取回来，接着写
```

**观察点：** 右侧 Stash 面板出现一条 `WIP on ...` 记录；三区面板右边出现黄色的 stash 卡片；`pop` 时改动飞回工作区。

---

## 第七章 · Worktree：一个仓库，多个文件夹

**解决一个问题：两个功能要同时开发，来回切分支太折腾？**

### 实验 08 · 一库多目录

```bash
git worktree add ../mark-todo-stats -b feature/stats master
```

- 点击**顶部目录标签**在两个文件夹之间切换（每个目录有独立的工作区和暂存区）；
- 在新目录里正常改代码、提交——**提交历史两边共享**（Graph 上立刻可见）；
- 切回主目录 `git merge feature/stats` 合并；
- 用完 `git worktree remove ../mark-todo-stats` 删除目录（提交不会丢）。

**观察点：** 顶部标签页 `+` 图标表示该分支正在另一个目录打开；这是 worktree 与"复制一份文件夹"的本质区别——复制出来的是两个互不相通的仓库。

---

## 第八章 · 远程：把历史备份到"GitHub"

**解决一个问题：电脑坏了/文件夹误删，代码怎么找回来？**

### 实验 09 · 推上远程

```bash
git remote add origin git@github.com:mark/mark-todo.git
git push -u origin master     # 首次推送并绑定本地与远程分支
# 日常：改代码 → git add → git commit → git push
git pull                      # 把远程的新提交拉回来
git clone git@github.com:mark/mark-todo.git 马克代办   # 演练"删库恢复"
```

**观察点：** 右侧 Remote 面板：LOCAL 与 REMOTE 两个迷你图谱被"网络"虚线隔开，push/pull 时光点跨线飞行、远端节点逐个点亮；SSH Key 卡片用一段话讲清"私钥留本地、公钥给 GitHub"的验证原理。状态栏会显示 ahead/behind 提醒你同步。

---

## 9 个实验总览

| 实验 | 章节 | 练什么 | 关键观察位置 |
| --- | --- | --- | --- |
| 01 第一次存档 | 入门 | init / status / add / commit | 三区面板飞行、Graph 第一个点 |
| 02 日常修改循环 | 入门 | 改代码 → diff → add → commit | Diff 面板、状态徽标 |
| 03 分支是指针 | 分支 | branch / switch / merge | 气泡标签移动、Fast-forward |
| 04 冲突现场 | 冲突 | merge 冲突 → 解决 → 提交 | 冲突面板、双亲提交 |
| 05 后悔药 | 回滚 | restore / revert / reset | 幽灵节点、Revert 提交 |
| 06 换地基 | Rebase | rebase / --continue | 逐个重放、幽灵变新点 |
| 07 临时收起 | Stash | 切分支被拒 → stash → pop | Stash 面板、黄色卡片 |
| 08 一库多目录 | Worktree | worktree add / 合并 | 顶部目录标签、共享历史 |
| 09 推上远程 | 远程 | remote / push -u / push | Remote 面板、跨线飞点 |

> 每个实验都可以随时点「重置场景」重来；退出实验后是自由模式，随便玩。

---

## 附：自由探索剧本（不跟实验，自己玩）

**剧本 A · 造一个 fast-forward 和一个真合并**：初始提交 → `git switch -c a` 提交 2 次 → `git switch master` → `git merge a`（观察：快进，无新点）→ `git switch -c b` 提交 1 次 → `git switch master` 直接提交 1 次 → `git merge b`（观察：菱形汇合点）。

**剧本 B · .gitignore 的魔力**：点「新建」创建 `notes.txt` 和 `.gitignore`（内容写一行 `notes.txt`）→ 看 `git status` 怎么变 → `git add .`（notes.txt 不会进来）→ 提交 .gitignore → 试着 `git add notes.txt` 看看 Git 怎么拒绝你。

**剧本 C · 三种 reset 逐个试**：提交 3 次 → 分别执行 `git reset --soft/--mixed/--hard HEAD~1`，对比每次文件区、暂存区、Graph 的差异，以及幽灵节点的出现。

**剧本 D · 双目录流水线**：worktree 开第二个目录 → 两边交替提交 → 观察 Graph 上两条车道交替生长 → 合并 → 删除 worktree → 确认提交还在。

**剧本 E · 错了也没关系**：试试 `git add 不存在的文件`、`git switch 不存在的分支`、`git commit`（不带 -m）——观察终端的真实报错，并确认界面状态分毫未动。

---

## 常见问题

- **命令敲错了会怎样？** 终端给出对齐真实 git 的报错（红色 `fatal:` / `error:`），仓库状态不变；
- **想清屏？** 输入 `clear` 或 Ctrl+L；
- **改坏的演示现场怎么重置？** 引导实验里点「重置场景」；或刷新页面回到初始状态；
- **支持哪些命令？** 右侧「帮助」面板有全量清单，或终端输入 `help`；
- **这是真的 Git 吗？** 不是——是一个用 TypeScript 写的 Mini Git 模拟引擎（见 `src/git-engine/`），专门为教学可视化而建，支持本文提到的全部命令。
