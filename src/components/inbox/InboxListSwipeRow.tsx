import { useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';

export type InboxRowAction = {
  key: string;
  label: string;
  className: string;
  onClick: () => void;
};

const ACTION_W = 72;
const AXIS_LOCK_PX = 10;
const OPEN_RATIO = 0.35;

type InboxListSwipeRowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: InboxRowAction[];
  children: React.ReactNode;
};

export default function InboxListSwipeRow({
  open,
  onOpenChange,
  actions,
  children,
}: InboxListSwipeRowProps) {
  const maxOffset = actions.length * ACTION_W;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    startOffset: 0,
    axis: null as 'x' | 'y' | null,
    active: false,
  });

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    if (!gestureRef.current.active) {
      const next = open ? maxOffset : 0;
      setOffset(next);
      offsetRef.current = next;
    }
  }, [open, maxOffset]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      gestureRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startOffset: offsetRef.current,
        axis: null,
        active: true,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!gestureRef.current.active) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = gestureRef.current.startX - t.clientX;
      const dy = gestureRef.current.startY - t.clientY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (gestureRef.current.axis === null) {
        if (adx < AXIS_LOCK_PX && ady < AXIS_LOCK_PX) return;
        gestureRef.current.axis = adx > ady ? 'x' : 'y';
      }

      if (gestureRef.current.axis === 'y') return;

      e.preventDefault();
      setDragging(true);
      const next = Math.max(0, Math.min(maxOffset, gestureRef.current.startOffset + dx));
      setOffset(next);
    };

    const finish = () => {
      if (!gestureRef.current.active) return;
      const wasX = gestureRef.current.axis === 'x';
      gestureRef.current.active = false;
      gestureRef.current.axis = null;
      setDragging(false);

      if (!wasX) return;

      const cur = offsetRef.current;
      const shouldOpen = cur > maxOffset * OPEN_RATIO;
      const next = shouldOpen ? maxOffset : 0;
      setOffset(next);
      offsetRef.current = next;
      onOpenChange(shouldOpen);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', finish, { passive: true });
    el.addEventListener('touchcancel', finish, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', finish);
      el.removeEventListener('touchcancel', finish);
    };
  }, [maxOffset, onOpenChange]);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 z-0 flex h-full">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={cn(
              'flex h-full w-[72px] shrink-0 flex-col items-center justify-center px-1 text-center text-[11px] font-semibold leading-tight text-white active:opacity-90',
              action.className
            )}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
              setOffset(0);
              offsetRef.current = 0;
              onOpenChange(false);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div
        ref={surfaceRef}
        className={cn(
          'relative z-[1] bg-inherit',
          !dragging && 'transition-transform duration-200 ease-out'
        )}
        style={{ transform: `translate3d(-${offset}px, 0, 0)` }}
      >
        {children}
      </div>
    </div>
  );
}
