import { useEffect, useRef } from 'react';
import { useLabStore } from '../store/useLabStore';
import type { AnimationOp } from '../types';

/** 订阅最近一次命令产生的动画操作（Engine → Animation 层的通道） */
export function useOpsEffect(handler: (ops: AnimationOp[], seq: number) => void) {
  const ops = useLabStore((s) => s.ops);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (ops.seq > 0) ref.current(ops.list, ops.seq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops.seq]);
}
