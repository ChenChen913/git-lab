# GIT-STATE-MODEL — 仓库状态模型

> 单一事实来源。所有 UI 区域均由此模型派生；命令以纯函数方式产生新模型。

## 1. 顶层模型

```text
Repository
├── initialized            是否已 git init
├── commits[]              所有 commit（含 ghost 掉的仍保留，仅 Graph 不显示）
├── branches{}             name → { commitId }（所有 worktree 共享）
├── worktrees[]            每个 worktree：独立的工作区+暂存区+HEAD+合并/变基进行中状态
│    ├── id / path / label
│    ├── head              { kind: 'branch'|'detached', branch?, commitId? }
│    ├── workingFiles{}    path → 行数组（磁盘内容）
│    ├── index{}           path → 行数组（暂存快照）
│    ├── mergeState?       合并进行中（冲突文件 ours/theirs/base）
│    └── rebaseState?      变基进行中（待重放 commits、当前冲突）
├── stashes[]              stash 条目（每 worktree）
├── remote?                { name, url, branches{} }（模拟的远程仓库）
├── ghosts[]               被 reset/rebase 丢弃的 commit（仅用于动画展示）
├── config                 user.name / user.email
└── clock                  自增序号（commit id、时间排序）
```

## 2. Commit / Branch / HEAD

```text
Commit: { id:'c3', hash:'a1b2c3d'(确定性伪hash), message, author, parents:['c2'], tree:{path→行数组}, merge?:true }
Branch: { name:'main', commitId:'c2' }      ← 分支本质：指向 commit 的引用（不是代码副本）
HEAD  : worktree.head → branch → commit     ← 支持 detached（clone 场景内部使用，UI 弱化）
```

不变量（任何命令执行后必须成立，属于验收条款）：

1. 分支 commitId 必须指向存在的 commit；commit.parents 必须指向存在的 commit。
2. 有 head.branch 时 head.branch 必须存在于 branches；HEAD 展示位置 = 分支指向的 commit。
3. 命令失败（返回 error）时仓库状态**逐字节不变**。
4. mergeState / rebaseState 存在时，对应 worktree 的工作区文件必须含冲突标记；`add` 全部冲突文件 + `commit` / `rebase --continue` 后状态清除。
5. worktree 之间共享 commits/branches/remote；各自 workingFiles、index、head、stash 相互独立。

## 3. 文件状态推导（status 的依据）

对 active worktree，设 `H` = 当前分支所指向 commit 的 tree：

| 条件 | 状态 | status 分组 |
| --- | --- | --- |
| path ∉ H 且 ∉ index，∈ workingFiles | Untracked | Untracked files |
| ∈ H，workingFiles ≠ H[path]，∉ staged 差异 | Modified（未暂存） | Changes not staged for commit |
| ∈ index 且 index[path] ≠ H[path] | Staged | Changes to be committed |
| ∈ index 且 ≠ H[path]，且 workingFiles[path] ≠ index[path] | Staged + 再修改 | 两组都出现 |
| index[path] = H[path] 且 workingFiles = H[path] | Clean（不显示） | — |

提示语映射（教学对齐教程）：`Untracked files` / `Changes not staged for commit` / `Changes to be committed` / `nothing to commit, working tree clean`。

## 4. 关键状态转换（与教程流程一一对应）

```text
git add            工作区内容复制进 index
git commit         index 打包为 commit 挂到当前分支，分支指针前移，index 与 HEAD 对齐
git restore        workingFiles ← HEAD tree
git restore --staged  index ← HEAD tree（不动工作区文件）
git reset --hard   分支指针回退 + index/工作区 ← 目标 tree（未提交改动全部丢失→ghost）
git reset --mixed  分支指针回退 + index ← 目标 tree（工作区保留改动）
git reset --soft   仅分支指针回退（index/工作区不动）
git revert         新 commit，tree = 被回滚 commit 的 parent 的 tree，parents=[HEAD]
git stash          工作区+暂存区与 HEAD 的差异快照进 stash；工作区/暂存区重置为 HEAD
git stash pop      快照内容写回工作区（改动回到未暂存态）
git merge (ff)     分支指针直接前移；不产生 commit
git merge (分叉)   三方比较：单边改动直接取；双边改动 → mergeState 冲突
git rebase         逐个把分支上的 commit 重放到新地基；冲突→add→--continue；原 commit 变 ghost
git worktree add   新 worktree：workingFiles/index = 基于 tree 的快照，head 指向新分支
git push           remote.branches[name] ← 本地分支（共享 commit 快照，Graph 可达集即远程内容）
git pull           remote 领先时：ff 或自动 merge；本地领先为 no-op
git clone          以 remote 可达历史重建本地仓库与 worktree
```

## 5. 简化声明（有意为之，服务教学）

- 文件内容只有"行数组"，无二进制；删除文件/重命名不建模。
- 合并冲突粒度为文件级（双边同文件不同改即冲突），解决方式：取当前 / 取合入 / 都保留（ours+theirs 顺序拼接）/ 手动编辑。
- stash pop 不处理应用冲突；pull 冲突时给出简化错误提示。
