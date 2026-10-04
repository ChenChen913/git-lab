import type { ParsedCommand, Token } from '../types';

export interface ParseOutcome {
  name: string | null; // git 子命令；非 git 命令为 null
  parsed: ParsedCommand | null;
  first: string; // 第一个 token（用于报错）
}

export function parseCommand(raw: string): ParseOutcome {
  const tokens: Token[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const text = m[1] ?? m[2] ?? m[3];
    tokens.push({ text, flag: text.startsWith('-') && text.length >= 2 });
  }
  if (!tokens.length || tokens[0].text !== 'git') {
    return { name: null, parsed: null, first: tokens[0]?.text ?? '' };
  }
  return {
    name: tokens[1]?.text ?? '',
    parsed: { name: tokens[1]?.text ?? '', tokens: tokens.slice(2), raw },
    first: tokens[1]?.text ?? '',
  };
}
