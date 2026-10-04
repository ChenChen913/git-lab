import type { CommandResult, OutputLine, Repository } from '../types';
import { parseCommand } from './parser';
import * as basic from './commands/basic';
import * as branchCmds from './commands/branch';
import * as history from './commands/history';
import * as extra from './commands/extra';
import { hasFlag } from './commands/util';

const HELP: OutputLine[] = [
  { kind: 'meta', text: 'Git Visual Lab 支持的命令：' },
  { kind: 'info', text: '  基础    git init / status / add <文件|.> / commit -m "说明" / log [--oneline] / diff [--staged]' },
  { kind: 'info', text: '  配置    git config user.name|user.email <值>' },
  { kind: 'info', text: '  分支    git branch [<名>|-d <名>] / switch <名> / switch -c <名> / merge <名> [--abort]' },
  { kind: 'info', text: '  回滚    git restore [.|--staged .] / reset [--hard|--mixed|--soft] HEAD~1 / revert HEAD' },
  { kind: 'info', text: '  变基    git rebase <分支> / --continue / --abort' },
  { kind: 'info', text: '  收纳    git stash [push] / pop / list' },
  { kind: 'info', text: '  目录    git worktree add <目录> -b <新分支> <基于分支> / list / remove <目录>' },
  { kind: 'info', text: '  远程    git remote add origin <url> / push [-u origin master] / pull / clone <url> [目录]' },
  { kind: 'info', text: '  其他    clear 清屏' },
  { kind: 'hint', text: '小技巧：文件要在左侧文件列表里点击编辑保存（相当于在编辑器里改代码），再用 git 命令提交' },
];

export interface ExecOutcome extends CommandResult {
  clear?: boolean;
  echo?: boolean;
  name?: string; // 实际执行的 git 子命令（教程校验用）
}

export function executeCommand(repo: Repository, raw: string): ExecOutcome {
  const trimmed = raw.trim();
  if (!trimmed) return { repo: null, output: [], ops: [], echo: true };
  if (trimmed === 'clear' || trimmed === 'cls') return { repo: null, output: [], ops: [], clear: true, name: 'clear' };

  const { name, parsed, first } = parseCommand(trimmed);
  if (!parsed) {
    return {
      repo: null,
      output: [
        { kind: 'error', text: `${first || trimmed}: command not found` },
        { kind: 'hint', text: '本实验室只模拟 git 命令；输入 help 查看支持的命令' },
      ],
      ops: [],
      name: undefined,
    };
  }

  return { ...dispatch(repo, name ?? '', parsed), name: name ?? undefined };
}

function dispatch(repo: Repository, name: string, parsed: import('../types').ParsedCommand): CommandResult {
  // 变更类命令：先清空上一条命令留下的幽灵节点（ ghosts 只存活到下一条命令 ）
  const mutating = !['status', 'log', 'diff', 'help', 'version', ''].includes(name);
  let base = repo;
  if (mutating) {
    base = structuredClone(repo);
    base.ghosts = [];
  }

  switch (name) {
    case 'init':
      return basic.cmdInit(base);
    case 'status':
      return basic.cmdStatus(repo);
    case 'add':
      return basic.cmdAdd(base, parsed);
    case 'commit':
      return basic.cmdCommit(base, parsed);
    case 'log':
      return basic.cmdLog(repo, parsed);
    case 'diff':
      return basic.cmdDiff(repo, parsed);
    case 'config':
      return basic.cmdConfig(base, parsed);
    case 'branch':
      return branchCmds.cmdBranch(base, parsed);
    case 'switch':
      return branchCmds.cmdSwitch(base, parsed, hasFlag(parsed, '-c'));
    case 'checkout':
      return branchCmds.cmdSwitch(base, parsed, hasFlag(parsed, '-b'));
    case 'merge':
      return branchCmds.cmdMerge(base, parsed);
    case 'restore':
      return history.cmdRestore(base, parsed);
    case 'reset':
      return history.cmdReset(base, parsed);
    case 'revert':
      return history.cmdRevert(base, parsed);
    case 'rebase':
      return history.cmdRebase(base, parsed);
    case 'stash':
      return extra.cmdStash(base, parsed);
    case 'worktree':
      return extra.cmdWorktree(base, parsed);
    case 'remote':
      return extra.cmdRemote(base, parsed);
    case 'push':
      return extra.cmdPush(base, parsed);
    case 'pull':
      return extra.cmdPull(base, parsed);
    case 'clone':
      return extra.cmdClone(base, parsed);
    case 'help':
      return { repo: null, output: HELP, ops: [] };
    case 'version':
      return { repo: null, output: [{ kind: 'muted', text: 'git version 2.51.0 (Git Visual Lab 模拟引擎)' }], ops: [] };
    default:
      return {
        repo: null,
        output: [
          { kind: 'error', text: `git: '${name}' is not a git command.` },
          { kind: 'hint', text: '输入 help 查看本实验室支持的命令' },
        ],
        ops: [],
      };
  }
}
