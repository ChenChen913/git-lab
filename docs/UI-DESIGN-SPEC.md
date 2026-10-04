# UI-DESIGN-SPEC — 视觉与交互规范（v2 扁平教学信息图风）

> v2 依据用户提供的 tu01–tu03 参考图（教学视频 UI 演示）全面替换 v1（明亮玻璃风）。
> 风格：**扁平卡片式教学信息图（Flat 2.0 / 贴纸感 MG 插图风）**。全程禁止渐变、玻璃拟态、3D、高饱和荧光色。
> 本文是 UI 实现的硬性依据；验收按第 6 节自查。

## 1. Design Tokens（src/index.css `:root`，全站唯一颜色来源，禁止散落硬编码）

| 令牌 | 值 | 语义 |
| --- | --- | --- |
| `--color-cream` | #F0EEE7 | 主线 commit 节点、工作区文件条 |
| `--color-blue` | #85ACE3 | master 提交节点、feature 标签底、add 箭头 |
| `--color-mint` | #B9DCC6 | master 标签底 |
| `--color-mint-border` | #7FCB96 | 提交历史区描边、commit 箭头 |
| `--color-orange` | #ECA763 | feature 分支节点与标签底 |
| `--color-yellow` | #E9D5A3 | 高亮圆环（HEAD）、rebase 动作、stash 描边 |
| `--color-zone-work` | #2C2C2C | 工作区卡片底（同时用于顶栏/终端/文件面板底） |
| `--color-zone-stage` | #2E3A50 | 暂存区卡片底 |
| `--color-zone-stage-border` | #6EA0E6 | 暂存区描边 |
| `--color-zone-history` | #2A4335 | 提交历史卡片底 |
| `--color-chip-stage` | #D4E0F6 | 暂存区文件条底 |
| `--color-ink` | #1E2B3A | 标签和箭头上的深色文字 |
| `--color-bg` | #3A3A3A | 页面中性深灰背景 |
| `--color-ghost` | #6F6A5E | 幽灵态灰褐降饱和填充 |
| 扩展 | ok=#7FCB96 / warn=#E9D5A3 / error=#D98D86 / info=#85ACE3 / muted / hairline | 终端语义与状态反馈 |

字体：`--font-mono`（JetBrains Mono/Fira Code/IBM Plex Mono/Consolas，**Bold**，只用于代码语义文字：分支名、命令、文件名、commit 编号、路径）；`--font-sans`（Noto Sans SC/PingFang SC/Microsoft YaHei，Bold/Heavy，中文标题与注释）。层级靠字重与字号对比。

圆角：大卡片 16px；子卡片 12px；chip/标签 10px；小徽章 6px；节点为正圆。
投影：统一单层柔和投影 `--shadow-flat: 0 2px 6px rgba(0,0,0,0.25)`；禁止多层阴影与发光。
描边：分区卡片 2px 亮色描边 + 深色底；幽灵态虚线描边 + 降饱和填充。

## 2. 视觉语义语法（教学用途，全程一致）

- 实心圆点 = 一个 commit；**圆点颜色 = 所属分支颜色**（创建时所在分支，记录于 commit.branch，ff 合并后仍保留原色）；
- 圆角矩形气泡 + 底部/顶部小三角指针 = 分支标签，底色 = 分支色，文字深色等宽粗体；master 气泡在节点上方（指向下），feature 气泡在节点下方（指向上）；
- 节点外套**实线黄色圆环** = 当前 HEAD / 指针所在位置；其他 worktree 的 HEAD 用虚线圆环；
- **虚线圆环 + 灰褐降饱和填充 + 虚线连接线** = 已移动或作废的历史（幽灵态），用于 rebase、reset 演示；
- 平滑贝塞尔曲线 = 分支分叉线，线色跟随分支色；主干为水平直线；
- **粗块状箭头 + 箭身等宽命令文字** = 命令流（git add = 雾蓝、git commit = 亮绿），箭头颜色对应目标区域；
- 描边式小圆角徽章（badge-outline）= 补充注释（未跟踪/已修改/已暂存等）。

## 3. 核心组件

1. **三区卡片**（ThreeAreas，对应 tu01）：工作区（深灰底）→ `git add` 蓝箭头 → 虚线 `.git` 逻辑分组框（内含暂存区与提交历史）→ 暂存区（深蓝底+亮蓝描边、标题浅蓝）→ `git commit` 绿箭头 → 提交历史（深绿底+亮绿描边、标题浅绿）；标题中文粗黑体；
2. **Commit 子卡片**：提交历史卡内嵌"更深一档底（黑 24%）+ 亮绿描边"圆角子卡片，标题等宽粗体 `Commit N`（N=创建顺序），内嵌该提交的文件条；
3. **文件条 chip**：文件类型小图标（HTML 橙、Markdown 蓝、JS 黄、CSS 薄荷）+ 等宽粗体文件名；chip 底色随所在分区变化（工作区米白 / 暂存区浅蓝 / 提交历史深绿半透明）；
4. **Commit Graph**（对应 tu02/tu03）：SVG；主干水平直线；分叉/汇合为平滑贝塞尔曲线；节点纯色正圆 + 单层投影；气泡标签 + 三角指针；黄圈 = HEAD；幽灵态表达 reset/rebase 丢弃的旧历史；
5. **逻辑分组框**：浅色虚线圆角框 + 左上角橙色 Git 图标 + 等宽 `.git`，表达"暂存区与提交历史位于 .git 内部"；
6. **交互状态**：选中/当前 = 实线圆环；过去/禁用 = 虚线 + 降饱和；文件飞行芯片沿用同色规则。

## 4. 动画原则

动画唯一目的：解释状态变化。文件沿路径飞行（add/unstage）、聚合光点飞入提交（commit）、指针 spring 移动、节点弹入、幽灵淡入、push 光点跨线——全部克制、有方向性与因果；尊重 prefers-reduced-motion。禁止粒子、爆炸、发光、大幅旋转。

## 5. 术语与文案

Git 核心术语英文主标题 + 中文小字辅助（Working Tree/工作区、Staging Area/暂存区、Commit History/提交历史）；Git 命令永远原样英文；普通界面文字（按钮/提示/实验说明）用简洁中文。禁止无功能意义的英文装饰标签。

## 6. 自查清单（通过/不通过）

1. 全站颜色是否只来自 tokens（无散落硬编码色值）？
2. 等宽字体是否只用于代码语义文字？
3. 是否已无渐变 / 玻璃拟态 / 多层阴影 / 发光 / 高饱和荧光色？
4. 视觉语义是否全程一致（圆点=提交、颜色=分支、黄圈=HEAD、虚线=幽灵）？
5. 页面背景是否为中性深灰（#3A3A3A）？
6. 三区卡片/Commit 子卡片/文件条/粗块箭头/.git 分组框是否按第 3 节实现？

## 7. v2 改动清单（对照改造前）

| 组件 | 改动 | 对应规范 |
| --- | --- | --- |
| src/index.css | 删除 .glass/.glass-panel/渐变背景；新增全部 Design Tokens、.flat-card/.zone/.badge-outline、单层投影 | 第 1、3 节 |
| ThreeAreas.tsx | 重写：深色三区卡 + 亮色描边、文件条带类型图标、粗块命令箭头（箭身文字）、.git 虚线分组框、Commit N 子卡片、状态徽章；飞行芯片改 tokens 配色 | 第 3.1–3.4、2 节 |
| CommitGraph.tsx | 重写为水平主干时间线；气泡标签+三角指针；黄圈 HEAD（多 worktree 虚线圈）；幽灵态（虚线+灰褐）；提交颜色溯源（commit.branch）；主干车道算法（master 第一父链恒为主行） | 第 2、3.4 节 |
| TopBar/StatusBar | 扁平深色条、worktree 平滑药丸标签、描边徽章状态 | 第 1、5 节 |
| FileExplorer | 文件列表改为米白文件条 + 类型图标 + 描边徽章；编辑器/新建弹窗扁平深色化 | 第 3.3 节 |
| Terminal | 深灰底 + tokens 语义色输出（ok/warn/error/info），等宽粗体 | 第 1 节扩展令牌 |
| RightPanel | 五个面板（实验/Diff/Stash/Remote/帮助）扁平卡片化；Remote 双分区用暂存蓝/历史绿语义 | 第 1、3 节 |
| ConflictPanel | 重写：深色卡 + 蓝区(HEAD)/橙区(合入分支)对照、差异行高亮、四种解决方式扁平按钮、深色遮罩（无模糊） | 第 1、2 节 |
| git-engine（仅元数据） | Commit 增加 `branch` 字段（创建时分支），供 Graph 颜色溯源；业务逻辑零改动 | 第 2 节 |
