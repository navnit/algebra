import { useMemo, useRef } from 'react';
import type { EquationSide } from '../domain/equation';
import type { AddendView } from '../utils/equationView';
import AddendChip from './chips/AddendChip';

interface EquationSideViewProps {
  title: string;
  side: EquationSide;
  addends: AddendView[];
  expandedProducts: Record<string, boolean>;
  onToggleProduct: (productId: string) => void;
  onCollapseProduct: (productId: string) => void;
  onDivide: (side: EquationSide, factorId: string) => void;
}

export default function EquationSideView({
  title,
  side,
  addends,
  expandedProducts,
  onToggleProduct,
  onCollapseProduct,
  onDivide,
}: EquationSideViewProps) {
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);

  const orderedAddends = useMemo(() => addends, [addends]);

  const focusChip = (index: number) => {
    const target = chipRefs.current[index];
    if (target) {
      target.focus();
    }
  };

  return (
    <div className="flex-1">
      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">{title}</div>
      <div className="flex flex-wrap items-start gap-3">
        {orderedAddends.map((addend, index) => (
          <AddendChip
            key={addend.id}
            ref={(node) => {
              chipRefs.current[index] = node;
            }}
            side={side}
            addend={addend}
            showSign={index !== 0}
            expanded={Boolean(addend.product && expandedProducts[addend.product.id])}
            onToggleProduct={onToggleProduct}
            onCollapseProduct={onCollapseProduct}
            onDivide={onDivide}
            onNavigate={(direction) => {
              if (direction === 'next' && index < orderedAddends.length - 1) {
                focusChip(index + 1);
              } else if (direction === 'prev' && index > 0) {
                focusChip(index - 1);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
