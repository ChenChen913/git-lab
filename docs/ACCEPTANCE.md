# ACCEPTANCE — 验收标准（通过/不通过制）

> 全部条目用具体命令序列验证；"实现/未实现"二值判定，禁止模糊表述。每条备注验证方法。

## A. 基础 Git（Phase 1）

| # | 验收点 | 判定 |
| --- | --- | --- |
| A1 | `git init` 能看到仓库创建过程（区域点亮、分支+HEAD 出现），而非仅一行文字 | ☐ |
| A2 | `git add index.html` 能看到文件 Working Tree → Staging Area 的方向性动画 | ☐ |
| A3 | `git commit` 能看到 Staging→Commit→Branch Pointer 完整变化（新节点、指针移动） | ☐ |
| A4 | Commit Graph 正确表达 parent relationship（连线随分叉/合并变化） | ☐ |
| A5 | `git status` 分组展示 Untracked / not staged / to be committed，文件状态徽标与三区一致 | ☐ |
| A6 | `git log` / `--oneline` 正确输出；`git diff` 展示 +/- 行 | ☐ |
| A7 | 状态一致性：任何命令后终端输出、文件树、三区面板、Graph、HEAD 五处一致；失败命令零状态变化 | ☐ |

## B. Branch（Phase 2）

| # | 验收点 | 判定 |
| --- | --- | --- |
| B1 | `git switch -c feature` 可见：分支创建、HEAD 改变、分支指针指向正确 commit | ☐ |
| B2 | 新分支初始与 main 指向同一 commit（文件区无变化，体现"分支不是复制代码"） | ☐ |
| B3 | 在分支上提交后 main 看不到这些 commit；切回 main 文件区同步还原 | ☐ |
| B4 | 未提交改动切分支被拒绝并报真实风格错误（would be overwritten） | ☐ |

## C. Merge（Phase 2/3）

| # | 验收点 | 判定 |
| --- | --- | --- |
| C1 | Fast-forward：main 直接前移，**不产生** merge commit | ☐ |
| C2 | 真分叉：产生 merge commit 且**两个 parents**，Graph 双线汇入 | ☐ |
| C3 | 合并后 HEAD/分支/Graph 一致 | ☐ |

## D. Conflict（Phase 3）

| # | 验收点 | 判定 |
| --- | --- | --- |
| D1 | 完整走通：建两分支→双改同一文件→merge→冲突→查看双方修改→解决→`git add`→`git commit` | ☐ |
| D2 | 冲突视图展示 ours vs theirs 对照及 `<<<<<<< HEAD` 风格标记 | ☐ |
| D3 | 四种解决方式（当前/合入/都保留/手动编辑）均可用 | ☐ |
| D4 | `git merge --abort` 完全复位 | ☐ |

## E. Rollback / Rebase / Stash（Phase 4）

| # | 验收点 | 判定 |
| --- | --- | --- |
| E1 | `restore` 与 `restore --staged` 的差异可见（后者不动工作区文件内容） | ☐ |
| E2 | `reset --hard/--mixed/--soft` 三种模式对三区的影响差异可观察；hard 丢弃的 commit 显示为 ghost | ☐ |
| E3 | `revert` 产生新 commit 且原 commit 保留在历史中 | ☐ |
| E4 | rebase 动画：A─B─C 与 C 后接 D─E → 重放为 C 后 D′─E′，能观察 commit 被逐个重新应用；冲突时 `--continue` 生效 | ☐ |
| E5 | stash：改动芯片收入 Stash 面板、文件区变干净可切分支；pop 后改动回到工作区 | ☐ |

## F. Worktree / Remote（Phase 5）

| # | 验收点 | 判定 |
| --- | --- | --- |
| F1 | 两个 worktree 拥有独立工作区与暂存区，**共享同一份 Commit History**（核心验收） | ☐ |
| F2 | 在 worktree B 提交，worktree A 的 Graph 立即可见；删除 worktree 后提交仍在 | ☐ |
| F3 | `git push` 后 Remote 图谱补齐，动画可见提交跨线同步；`push -u` 后日常 `git push` 可用 | ☐ |
| F4 | `git pull` / `git clone` 表现同步/重建 | ☐ |

## G. Tutorial（Phase 6）

| # | 验收点 | 判定 |
| --- | --- | --- |
| G1 | ≥6 个实验，含任务步骤、命令校验、进度、成功反馈 | ☐ |
| G2 | 步骤必须由用户真实输入命令完成（非点击按钮代劳） | ☐ |

## H. 架构与体验（Phase 7）

| # | 验收点 | 判定 |
| --- | --- | --- |
| H1 | Engine 独立于 UI（git-engine 无 React/zustand import） | ☐ |
| H2 | 动画独立于命令逻辑（无 per-command 硬编码动画；ops 语义化） | ☐ |
| H3 | 命令解析独立于组件（组件内无 `if (command === ...)`） | ☐ |
| H4 | 非法命令得到模拟错误且 UI 状态不变（如 add 不存在文件、switch 不存在分支） | ☐ |
| H5 | 视觉：明亮专业、层级清晰、Graph 为视觉中心；动画有 Before→Transition→After | ☐ |
| H6 | `npm run build` 通过（tsc + vite build 无错误） | ☐ |

## 标准验证剧本（部分）

```bash
# A 组
git init
git status
git add index.html
git commit -m "Add homepage"
git log --oneline
git diff
# C1 ff：main 直接前移
git switch -c feature/sort
# （在 feature/sort 上）git add . ; git commit -m "Sort"
git switch main
git merge feature/sort            # → Fast-forward，Graph 无新节点
# C2 分叉：
git switch -c feature/complete
# 提交后 git switch main ; （main 上再提交） ; git merge feature/complete → 双亲节点
# E4 rebase：feature 落后 main 两个 commit 时 git rebase main → D′ E′
```
