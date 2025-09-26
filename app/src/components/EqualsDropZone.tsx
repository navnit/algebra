import { useDroppable } from '@dnd-kit/core';

export default function EqualsDropZone() {
  const left = useDroppable({ id: 'equals-left', data: { dropType: 'equals', side: 'left' } });
  const right = useDroppable({ id: 'equals-right', data: { dropType: 'equals', side: 'right' } });

  return (
    <div className="flex flex-col items-center gap-3 px-4 text-3xl font-bold text-primary">
      <div
        ref={left.setNodeRef}
        className={`h-10 w-16 rounded-full border border-dashed border-primary/40 bg-primary/5 text-center text-sm font-medium uppercase tracking-wide leading-10 text-primary/80 ${
          left.isOver ? 'bg-accent/20 text-accent' : ''
        }`}
      >
        ← Move
      </div>
      <div>=</div>
      <div
        ref={right.setNodeRef}
        className={`h-10 w-16 rounded-full border border-dashed border-primary/40 bg-primary/5 text-center text-sm font-medium uppercase tracking-wide leading-10 text-primary/80 ${
          right.isOver ? 'bg-accent/20 text-accent' : ''
        }`}
      >
        Move →
      </div>
    </div>
  );
}
