import { create } from 'zustand';
import type { AnimationOp, DiffPayload, OutputKind, OutputLine, Repository } from '../types';
import { activeWt, initialRepo } from '../git-engine/repository';
import { executeCommand } from '../git-engine/engine';
import { initialWorkFiles } from '../sample/project';
import { LESSONS, runSetup } from '../tutorial/lessons';

export interface TerminalLine {
  id: number;
  kind: OutputKind;
  text: string;
  prompt?: string;
}

export type RightTab = 'tutorial' | 'diff' | 'stash' | 'remote' | 'help';

interface LabState {
  repo: Repository;
  lines: TerminalLine[];
  ops: { seq: number; list: AnimationOp[] };
  lastDiff: DiffPayload | null;
  rightTab: RightTab;
  editing: string | null;
  newFileOpen: boolean;
  lessonId: string | null;
  stepIndex: number;
  lessonDone: boolean;
  lastCommand: string;
  lineSeq: number;
  onboarding: boolean;

  runCommand: (raw: string) => void;
  setActiveWorktree: (id: string) => void;
  saveFile: (path: string, content: string) => void;
  createFile: (path: string) => void;
  resolveConflict: (path: string, content: string) => void;
  openEditor: (path: string | null) => void;
  setNewFileOpen: (v: boolean) => void;
  setRightTab: (t: RightTab) => void;
  startLesson: (id: string) => void;
  stopLesson: () => void;
  dismissOnboarding: () => void;
}

function freshRepo(): Repository {
  const r = initialRepo();
  r.worktrees[0].workingFiles = initialWorkFiles();
  return r;
}

export function promptText(repo: Repository): string {
  const wt = activeWt(repo);
  const dir = wt.id === 'wt-main' ? `~/projects/${wt.label}` : `~/projects/${wt.label}`;
  const branch = repo.initialized ? ` (${wt.head.branch ?? 'HEAD'})` : '';
  return `${dir}${branch} $`;
}

export const useLabStore = create<LabState>((set, get) => {
  let lineSeq = 0;

  const pushLines = (push: (ls: TerminalLine[]) => void, out: OutputLine[], prompt?: string) => {
    push(out.map((l) => ({ id: ++lineSeq, kind: l.kind, text: l.text, prompt })));
  };

  /** 教程步骤推进：允许一条命令连续满足多个步骤 */
  const advanceLesson = (repo: Repository, lastCommand: string, push: (ls: TerminalLine[]) => void) => {
    const { lessonId, stepIndex, lessonDone } = get();
    if (!lessonId || lessonDone) return;
    const lesson = LESSONS.find((l) => l.id === lessonId);
    if (!lesson) return;
    let idx = stepIndex;
    while (idx < lesson.steps.length) {
      const ok = lesson.steps[idx].check({ repo, wt: activeWt(repo), lastCommand });
      if (!ok) break;
      pushLines(push, [{ kind: 'success', text: `✓ 步骤 ${idx + 1} 完成：${lesson.steps[idx].instruction}` }]);
      idx++;
    }
    if (idx >= lesson.steps.length && !lessonDone) {
      pushLines(push, [
        { kind: 'success', text: `🎉 实验完成：${lesson.title}` },
        { kind: 'hint', text: '可以开始下一个实验，或切到自由模式随便玩（重置场景会重新开始）' },
      ]);
      set({ stepIndex: idx, lessonDone: true });
      return;
    }
    set({ stepIndex: idx });
  };

  return {
    repo: freshRepo(),
    lines: [
      { id: 1, kind: 'hint', text: 'Git Visual Lab — 输入 git 命令并回车；输入 help 查看支持命令；点击右上角「引导实验」跟着学' },
      { id: 2, kind: 'muted', text: '演示项目「马克代办」已就绪（尚未 git init）。先试试：git init' },
    ],
    ops: { seq: 0, list: [] },
    lastDiff: null,
    rightTab: 'tutorial',
    editing: null,
    newFileOpen: false,
    lessonId: null,
    stepIndex: 0,
    lessonDone: false,
    lastCommand: '',
    lineSeq: 3,
    onboarding: !localStorage.getItem('gvl-onboarded'),

    runCommand: (raw) => {
      const state = get();
      const repo = state.repo;
      const prompt = promptText(repo);
      const echo: TerminalLine = { id: ++lineSeq, kind: 'info', text: raw, prompt };
      const out: TerminalLine[] = [echo];

      const res = executeCommand(repo, raw);
      if (res.clear) {
        set({ lines: [] });
        return;
      }
      pushLines((ls) => out.push(...ls), res.output);

      let nextRepo = repo;
      let nextOps = state.ops;
      let nextDiff = state.lastDiff;
      let nextTab = state.rightTab;
      if (res.repo) {
        nextRepo = res.repo;
        nextOps = { seq: state.ops.seq + 1, list: res.ops };
        if (res.diff) {
          nextDiff = res.diff;
          nextTab = 'diff';
        }
      }

      set({
        lines: [...state.lines, ...out],
        repo: nextRepo,
        ops: nextOps,
        lastDiff: nextDiff,
        rightTab: nextTab,
        lastCommand: res.name ?? state.lastCommand,
      });

      // 教程推进
      const after = get();
      const tutOut: TerminalLine[] = [];
      advanceLesson(after.repo, res.name ?? '', (ls) => tutOut.push(...ls));
      if (tutOut.length) set({ lines: [...get().lines, ...tutOut] });
    },

    setActiveWorktree: (id) => {
      const state = get();
      const next = structuredClone(state.repo);
      next.activeWorktreeId = id;
      set({ repo: next });
      const tutOut: TerminalLine[] = [];
      advanceLesson(next, state.lastCommand, (ls) => tutOut.push(...ls));
      if (tutOut.length) set({ lines: [...get().lines, ...tutOut] });
    },

    saveFile: (path, content) => {
      const state = get();
      const next = structuredClone(state.repo);
      const wt = activeWt(next);
      wt.workingFiles[path] = content.split('\n');
      set({ repo: next, editing: null });
      const tutOut: TerminalLine[] = [];
      advanceLesson(next, state.lastCommand, (ls) => tutOut.push(...ls));
      if (tutOut.length) set({ lines: [...get().lines, ...tutOut] });
    },

    createFile: (path) => {
      const state = get();
      const next = structuredClone(state.repo);
      const wt = activeWt(next);
      if (!wt.workingFiles[path]) wt.workingFiles[path] = [''];
      set({ repo: next, newFileOpen: false });
    },

    resolveConflict: (path, content) => {
      const state = get();
      const next = structuredClone(state.repo);
      const wt = activeWt(next);
      const lines = content.split('\n');
      wt.workingFiles[path] = lines;
      if (wt.mergeState?.conflicts[path]) wt.mergeState.conflicts[path].resolved = true;
      if (wt.rebaseState?.conflicts[path]) wt.rebaseState.conflicts[path].resolved = true;
      set({ repo: next });
      const tutOut: TerminalLine[] = [];
      advanceLesson(next, state.lastCommand, (ls) => tutOut.push(...ls));
      if (tutOut.length) set({ lines: [...get().lines, ...tutOut] });
    },

    openEditor: (path) => set({ editing: path }),
    setNewFileOpen: (v) => set({ newFileOpen: v }),
    setRightTab: (t) => set({ rightTab: t }),
    dismissOnboarding: () => {
      try {
        localStorage.setItem('gvl-onboarded', '1');
      } catch {
        /* 忽略存储失败 */
      }
      set({ onboarding: false });
    },

    startLesson: (id) => {
      const lesson = LESSONS.find((l) => l.id === id);
      if (!lesson) return;
      const repo = runSetup(freshRepo(), lesson.setup);
      lineSeq += 2;
      set({
        repo,
        lessonId: id,
        stepIndex: 0,
        lessonDone: false,
        lines: [
          { id: ++lineSeq, kind: 'meta', text: `—— ${lesson.title} ——` },
          { id: ++lineSeq, kind: 'hint', text: `目标：${lesson.goal}` },
          ...repo.worktrees[0].workingFiles['index.html']
            ? []
            : [],
        ],
        rightTab: 'tutorial',
        lastDiff: null,
      });
    },

    stopLesson: () => set({ lessonId: null, stepIndex: 0, lessonDone: false }),
  };
});
