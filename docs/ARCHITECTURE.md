# ARCHITECTURE — Git Visual Lab

## 1. 分层总览

```text
┌─────────────────────────────────────────────────────┐
│ UI 层（React 组件：终端/文件区/三区面板/Graph/面板）        │
│   └── Animation Layer：把 AnimationOperation 翻译成动效    │
├─────────────────────────────────────────────────────┤
│ Store 层（Zustand）：唯一持有 Repository State            │
├─────────────────────────────────────────────────────┤
│ Git Engine（纯 TypeScript，不知道 React/UI 的存在）        │
│   ├── Parser：字符串 → Command 对象                       │
│   ├── Commands：Command 对象 → 新 Repository State        │
│   │              + Terminal Output + AnimationOperations │
│   └── State Utils：状态推导（file status/可达性/diff）      │
└─────────────────────────────────────────────────────┘
```

数据流（严格单向）：

```text
输入命令 → Parser → Command 执行（纯函数，旧状态 → 新状态）
        → { repo', output[], ops[] } → Store 更新 → UI 重渲染
        → UI 依据 State Diff + ops 播放动画
```

## 2. 解耦规则（架构验收红线）

1. **Engine 不依赖 UI**：`src/git-engine/**` 不得 import React、zustand 或任何组件；全部为纯函数，输入旧状态输出新状态。
2. **Command 不写死动画**：命令只产出语义化 `AnimationOperation`（如 `FILE_STAGED`、`COMMIT_CREATED`、`HEAD_MOVED`），不知道"往哪飞、飞多快"。
3. **组件不做 Git 逻辑**：组件中不允许出现 `if (cmd === 'git add')` 式业务分支；组件只从 store 读状态、读 ops 渲染。
4. **单一事实来源**：整个应用只有 store 里的一份 `Repository`。终端、文件树、三区面板、Commit Graph、HEAD/分支标签全部从它派生，保证状态一致性（终端说成功，Graph 必然已变化；命令失败则状态不变）。

## 3. 目录结构

```text
src/
├── types/            # Git 状态模型 & 动画操作类型
├── git-engine/       # 纯逻辑层
│   ├── commands/     # 每条命令一个实现（init/add/commit/...）
│   ├── parser/       # 命令解析
│   ├── repository/   # 状态模型、状态推导、不可变更新工具
│   ├── text/         # 行 diff / 冲突标记生成
│   └── engine.ts     # 入口：parse → execute → result
├── store/            # Zustand store（repo + terminal + UI 状态）
├── animation/        # ops → 动效参数（时长/方向/高亮目标）
├── components/       # 展示组件（面板、图、终端……）
├── tutorial/         # 引导实验定义与校验
└── sample/           # 演示项目初始文件内容
```

## 4. 关键技术决策

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 框架 | React 18 + TypeScript + Vite | 任务书推荐；开发快、类型安全 |
| UI | Tailwind CSS v4 + lucide-react | 快速建立清晰层级；图标统一 |
| 动画 | Framer Motion | 声明式、layout 动画适合"文件在区域间移动" |
| 状态 | Zustand | 单一 store 持有 repo/terminal/ops，组件按需订阅 |
| Commit Graph | 手写 SVG | 结构简单（行列布局+贝塞尔连线），不引入重图库 |
| 文件内容 | 行数组快照 | commit 存全量快照（教学模拟足够），diff 基于行 LCS |
| Commit id | 自增逻辑号 `c1..n` + 确定性伪 hash | 图上可读且唯一；`HEAD~n` 可解析 |

## 5. 动画实现策略

- **主体动画来自 State Diff**：列表增删用 `AnimatePresence`，同元素跨面板移动用共享 `layoutId`（文件从工作区→暂存区即由 layout 动画自动完成），Graph 上新节点 scale-in、分支标签用 `motion.g` 位置 spring 过渡——这些都是"状态变了，UI 自然过渡"。
- **ops 用于方向性与强调**：`FILE_STAGED` 让中间箭头沿方向脉冲、目标芯片短暂高亮；`PUSH_SYNCED` 触发跨分隔线飞点；`COMMIT_REPLAYED` 让旧节点变幽灵、新节点闪现。Store 记录 `lastOps + seq`，组件 effect 消费。
- 回滚/变基产生的"被丢弃的 commit"进入 **ghost 集合**，以半透明渲染，直到下一条非该类命令执行，帮助用户理解"commit 被挤出去/被重写"。

## 6. 可扩展性

新增一条 Git 命令 = 新增一个 command 实现 + 在 registry 注册，UI 与动画层零改动（动画自动由状态 diff 驱动，特殊强调再补一条 op 映射）。新增一个实验 = 在 `tutorial/lessons.ts` 增加一份定义。
