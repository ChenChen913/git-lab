// Git 仓库状态模型 —— 单一事实来源（详见 docs/GIT-STATE-MODEL.md）

export type Line = string;

export type DiffRow = { type: 'same' | 'add' | 'del'; text: string };

export interface DiffFilePayload {
  path: string;
  rows: DiffRow[];
}

export interface DiffPayload {
  scope: 'work' | 'staged';
  files: DiffFilePayload[];
}

export interface Commit {
  id: string; // "c1"、"c2"…… 自增逻辑号
  hash: string; // 7 位确定性伪 hash，用于展示
  message: string; // 可含 \n（revert 场景）
  author: string;
  parents: string[];
  tree: Record<string, Line[]>; // 全量快照 path → 行
  merge: boolean; // 是否为合并提交（两个 parents）
  order: number; // 创建顺序（时钟），用于排序
  branch?: string; // 创建时所在分支（用于 Graph 颜色溯源）
}

export interface Branch {
  name: string;
  commitId: string | null; // null = 还没有任何提交
}

export interface Head {
  kind: 'branch' | 'detached';
  branch?: string;
  commitId?: string;
}

export interface ConflictInfo {
  path: string;
  ours: Line[]; // 当前分支（HEAD）版本
  theirs: Line[]; // 被合并/被重放分支版本
  base: Line[]; // 共同祖先版本
  resolved: boolean; // 面板/编辑器确认过解决
}

export interface MergeState {
  theirsBranch: string; // 展示名（如 feature/complete-all 或 origin/master）
  theirsCommitId: string;
  baseCommitId: string;
  conflicts: Record<string, ConflictInfo>;
}

export interface RebaseState {
  originalBranch: string;
  originalTipId: string;
  ontoBranch: string;
  replayBaseId: string; // 当前重放位置（新链的最新 commit）
  pending: { id: string; message: string; author: string; tree: Record<string, Line[]> }[];
  conflicts: Record<string, ConflictInfo>;
}

export interface StashEntry {
  seq: number; // 第几个 stash（新的大）
  worktreeId: string;
  label: string; // WIP on main: c3 添加排序
  files: Record<string, Line[]>; // 工作区内容快照
  indexFiles: Record<string, Line[]>; // 暂存区内容快照（仅与 HEAD 不同的）
  baseCommitId: string;
}

export interface Worktree {
  id: string;
  path: string; // "." 或 "../mark-todo-stats"
  label: string; // 展示名（mark-todo / mark-todo-stats）
  head: Head;
  workingFiles: Record<string, Line[]>;
  index: Record<string, Line[]>;
  mergeState: MergeState | null;
  rebaseState: RebaseState | null;
}

export interface Remote {
  name: string; // origin
  url: string;
  branches: Record<string, string>; // 分支名 → commitId
}

export interface GitConfig {
  userName: string;
  userEmail: string;
}

export interface Repository {
  initialized: boolean;
  clock: number; // 自增序号
  commits: Record<string, Commit>;
  branches: Record<string, Branch>;
  worktrees: Worktree[];
  activeWorktreeId: string;
  stashes: StashEntry[];
  remote: Remote | null;
  ghosts: Commit[]; // 被 reset/rebase 丢弃的 commit（仅供展示）
  config: GitConfig;
}

// ---------- 动画操作（Engine → Animation 层的唯一语言） ----------

export type AnimationOp =
  | { type: 'REPO_INITIALIZED' }
  | { type: 'FILE_STAGED'; paths: string[] }
  | { type: 'FILE_UNSTAGED'; paths: string[] }
  | { type: 'FILE_RESTORED'; paths: string[] }
  | { type: 'COMMIT_CREATED'; commitId: string }
  | { type: 'BRANCH_CREATED'; name: string }
  | { type: 'BRANCH_DELETED'; name: string }
  | { type: 'HEAD_MOVED'; branch?: string; commitId?: string }
  | { type: 'BRANCH_MOVED'; name: string; toCommitId: string; mode: 'ff' | 'reset' }
  | { type: 'CONFLICT_CREATED'; paths: string[]; theirsBranch: string }
  | { type: 'CONFLICT_RESOLVED'; paths: string[] }
  | { type: 'MERGE_ABORTED' }
  | { type: 'COMMIT_REPLAYED'; fromId: string; toId: string }
  | { type: 'REVERT_HIGHLIGHT'; commitId: string }
  | { type: 'STASH_CREATED'; count: number }
  | { type: 'STASH_POPPED' }
  | { type: 'WORKTREE_ADDED'; id: string }
  | { type: 'WORKTREE_REMOVED'; id: string }
  | { type: 'REMOTE_ADDED' }
  | { type: 'PUSH_SYNCED'; count: number }
  | { type: 'PULL_SYNCED'; count: number }
  | { type: 'CLONED' }
  | { type: 'HIGHLIGHT'; target: string };

// ---------- 终端输出 ----------

export type OutputKind =
  | 'info'
  | 'muted'
  | 'success'
  | 'error'
  | 'add'
  | 'del'
  | 'hint'
  | 'meta'
  | 'warn';

export interface OutputLine {
  kind: OutputKind;
  text: string;
}

export interface CommandResult {
  repo: Repository | null; // null = 状态无变化
  output: OutputLine[];
  ops: AnimationOp[];
  diff?: DiffPayload; // git diff 的结构化结果（供 Diff 面板展示）
}

// ---------- 命令解析 ----------

export interface Token {
  text: string;
  flag: boolean; // 以 - 开头的选项（-m / --hard / -c ...）
}

export interface ParsedCommand {
  name: string; // 子命令，如 add / commit；空表示裸 git
  tokens: Token[]; // 子命令之后的全部 token
  raw: string;
}
