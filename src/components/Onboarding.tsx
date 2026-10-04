import { motion } from 'framer-motion';
import { BookOpen, FileText, GitBranch, TerminalSquare, Waypoints, X } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

/** 首访引导浮层：用四步告诉用户界面怎么玩（只出现一次，可关闭） */
export function Onboarding() {
  const onboarding = useLabStore((s) => s.onboarding);
  const dismiss = useLabStore((s) => s.dismissOnboarding);
  const setRightTab = useLabStore((s) => s.setRightTab);
  if (!onboarding) return null;

  const steps = [
    {
      icon: <FileText className="h-4 w-4" />,
      color: 'var(--color-orange)',
      title: '① 左侧 · 改代码',
      desc: '点击文件（如 index.html）在编辑器里修改并保存——这就是"写代码"。',
    },
    {
      icon: <TerminalSquare className="h-4 w-4" />,
      color: 'var(--color-info)',
      title: '② 底部 · 敲命令',
      desc: '在终端输入 git 命令并回车：git init → git add → git commit。',
    },
    {
      icon: <GitBranch className="h-4 w-4" />,
      color: 'var(--color-mint-border)',
      title: '③ 中间 · 看动画',
      desc: '文件在三个区域之间移动，Commit Graph 展示每一次提交与分支变化。',
    },
    {
      icon: <BookOpen className="h-4 w-4" />,
      color: 'var(--color-yellow)',
      title: '④ 右侧 · 跟实验学',
      desc: '9 个引导实验手把手带你走完 Git 主线，每一步自动校验。',
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(30,43,58,0.35)' }}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flat-card w-[640px] max-w-full p-6"
        style={{ background: 'var(--color-panel)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Waypoints className="h-5 w-5" style={{ color: 'var(--color-orange)' }} />
              <span className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>欢迎使用 Git 可视化交互实验室</span>
            </div>
            <div className="mt-1 text-[12px] font-bold" style={{ color: 'var(--color-muted)' }}>
              不是读教程，而是亲手操作——每敲一条命令，都能看见 Git 内部状态的变化。
            </div>
          </div>
          <button onClick={dismiss} style={{ color: 'var(--color-muted)' }} title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {steps.map((s) => (
            <div key={s.title} className="flex items-start gap-2.5 p-3" style={{ ...cardLite, borderColor: s.color }}>
              <span className="mt-0.5" style={{ color: s.color }}>{s.icon}</span>
              <div>
                <div className="text-xs font-bold" style={{ color: 'var(--color-ink)' }}>{s.title}</div>
                <div className="mt-0.5 text-[11px] font-bold leading-relaxed" style={{ color: 'var(--color-muted)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => {
              dismiss();
              useLabStore.getState().startLesson('lesson-01');
            }}
            className="px-4 py-2 text-xs font-bold"
            style={{ borderRadius: 'var(--radius-chip)', background: 'var(--color-mint)', color: 'var(--color-ink)', boxShadow: 'var(--shadow-flat)' }}
          >
            从实验 01 开始
          </button>
          <button
            onClick={dismiss}
            className="px-4 py-2 text-xs font-bold"
            style={{ borderRadius: 'var(--radius-chip)', border: '1.5px solid var(--color-hairline)', color: 'var(--color-muted)' }}
          >
            自由探索
          </button>
          <span className="ml-auto text-[10px] font-bold" style={{ color: 'var(--color-muted)' }}>
            图文完整手册见项目 docs/USAGE.md
          </span>
        </div>
      </motion.div>
    </div>
  );
}

const cardLite: React.CSSProperties = {
  borderRadius: 'var(--radius-sub)',
  border: '1.5px solid var(--color-hairline)',
  background: 'var(--color-panel)',
};
