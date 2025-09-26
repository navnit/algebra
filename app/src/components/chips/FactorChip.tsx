import { forwardRef, type MutableRefObject } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { InlineMath } from 'react-katex';
import type { EquationSide } from '../../domain/equation';
import type { FactorView } from '../../utils/equationView';

interface FactorChipProps {
  factor: FactorView;
  side: EquationSide;
}

const FactorChip = forwardRef<HTMLDivElement, FactorChipProps>(function FactorChip({ factor, side }, ref) {
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
    id: `${side}-factor-${factor.id}`,
    data: {
      type: 'factor',
      side,
      nodeId: factor.id,
      latex: factor.latex,
      isConstant: factor.isConstant,
      parentProductId: factor.parentProductId,
    },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `factor-${side}-${factor.id}`,
    data: {
      dropType: factor.isGroup ? 'group' : 'factor',
      side,
      nodeId: factor.id,
      isConstant: factor.isConstant,
      parentProductId: factor.parentProductId,
    },
  });

  const combineRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };

  return (
    <div
      ref={combineRef}
      tabIndex={0}
      className={`rounded-full border border-slate-300 bg-white px-3 py-1 text-base text-neutral shadow-soft focus:outline-none focus:ring-2 focus:ring-accent ${
        isDragging ? 'opacity-60 ring-2 ring-accent' : ''
      } ${isOver ? 'border-accent/60 bg-accent/10' : ''}`}
      {...listeners}
      {...attributes}
    >
      <InlineMath math={factor.latex} />
    </div>
  );
});

export default FactorChip;
