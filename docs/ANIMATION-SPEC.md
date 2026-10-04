# ANIMATION-SPEC — 动画规格

## 1. 原则

动画只为回答一个问题：**Git 到底发生了什么？** 每个动画必须表达"从哪里来、到哪里去、方向与因果"。克制、清晰、有状态过渡；不炫技、不为动画而动画。全部核心动画由 State Diff 驱动（Framer Motion layout/AnimatePresence），ops 仅提供方向强调与特效。

## 2. AnimationOperation 类型（Engine → Animation 层的唯一语言）

```text
REPO_INITIALIZED          FILE_STAGED{path}         FILE_UNSTAGED{path}
FILE_RESTORED{path}       COMMIT_CREATED{commitId}  BRANCH_CREATED{name}
BRANCH_DELETED{name}      HEAD_MOVED{to}            BRANCH_MOVED{name,to,mode}
FAST_FORWARD{branch,from,to}   MERGE_COMMIT_CREATED{commitId,parents}
CONFLICT_CREATED{files,theirs} CONFLICT_RESOLVED{path}   MERGE_ABORTED
COMMIT_REPLAYED{fromId,toId}   REVERT_HIGHLIGHT{commitId}
STASH_CREATED{id}         STASH_POPPED{id}
WORKTREE_ADDED{id,branch} WORKTREE_REMOVED{id}
REMOTE_ADDED              PUSH_SYNCED{commitIds}    PULL_SYNCED{commitIds}
CLONED                    HIGHLIGHT{target}
```

## 3. 各操作编排

| 命令场景 | 视觉编排 |
| --- | --- |
| init | 三个区域面板与 Graph 依次点亮（stagger 60ms），默认分支标签+HEAD 从节点后浮现 |
| add | 文件芯片从工作区面板滑入暂存区面板（共享 layoutId 自动补间），中间箭头沿方向脉冲一次，目标芯片绿色高亮 600ms |
| restore / restore --staged | 同上反向；restore --staged 时工作区芯片仅闪烁（文件内容未变的暗示） |
| commit | 暂存区芯片缩小聚合 → 飞向 Graph 新节点位置；节点 scale-in；分支标签 spring 滑到新节点；HEAD 跟随 |
| branch | 新标签在对应节点旁弹出（opacity+y） |
| switch | HEAD 徽标弹跳到新分支；文件区芯片按新 tree 交叉淡切 |
| merge (ff) | 分支标签沿主线滑动；路线加粗一次 |
| merge (commit) | 两条父线以描边动画汇入新节点；新节点弹入且带双亲徽标 |
| conflict | 冲突文件行红色脉冲；冲突面板展开：ours 蓝 / theirs 橙 左右对照，中间 VS 徽标对撞入场 |
| resolve→add→commit | 冲突块收拢 → 芯片进暂存 → 双亲 commit 弹入 |
| reset --hard | 指针回滑；被挤出 commit 变 ghost（半透明+删除线），其文件芯片抖动后消失 |
| reset --mixed | 指针回滑；暂存区芯片滑回工作区 |
| reset --soft | 仅指针回滑，文件区无变化（这正是教学点） |
| revert | 原节点闪黄 → 反向虚线 → 新节点弹入，历史中原节点保留 |
| rebase | 逐 commit：旧节点变 ghost → 虚线弧连到新地基 → 新节点 D′ 弹入 → 指针滑向链尾；`--continue` 后下一个 commit 接续重放 |
| stash | 工作区改动芯片收拢折入 Stash 卡片（缩放+位移）；文件区变干净 |
| stash pop | Stash 卡片条目飞回工作区后消散 |
| worktree add | 顶部新目录标签页生长；Graph 中该分支 HEAD 标注浮现；共享历史区描边强调 |
| push | Remote 分区：每个新 commit 沿分隔线飞点同步，远端节点逐个点亮；完成后双侧对齐框绿闪 |
| pull | 反向飞点 |
| clone | 远端整组节点坠落至本地侧 |

## 4. 时长与缓动基准

- 微交互（高亮/脉冲）：250–500ms，easeOut
- 指针/标签移动：spring（stiffness 300, damping 26）
- 节点入場：scale 0.6→1 + fade，260ms
- 大过渡（切 worktree/clone）：320ms easeInOut
- 尊重 `prefers-reduced-motion`：降级为即时切换 + 高亮闪烁

## 5. 幽灵节点（ghost）

reset / rebase 丢弃或重写的 commit 进入 ghosts：以 35% 透明度、虚线描边渲染在原位置，并保留其 lane 一段时间，帮助用户看见"旧历史去了哪里"。下一条变更历史的命令执行时清空。
