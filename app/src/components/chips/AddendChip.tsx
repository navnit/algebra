import { forwardRef, type MutableRefObject } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { InlineMath } from 'react-katex';
import type { EquationSide } from '../../domain/equation';
import type { AddendView, ProductView } from '../../utils/equationView';
import FactorChip from './FactorChip';

interface AddendChipProps {
  side: EquationSide;
  addend: AddendView;
  showSign: boolean;
  expanded: boolean;
  onToggleProduct: (productId: string) => void;
  onCollapseProduct: (productId: string) => void;
  onDivide: (side: EquationSide, factorId: string) => void;
  onNavigate: (direction: 'next' | 'prev') => void;
}

const AddendChip = forwardRef<HTMLDivElement, AddendChipProps>(function AddendChip(
  { side, addend, showSign, expanded, onToggleProduct, onCollapseProduct, onDivide, onNavigate },
  ref,
) {
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
    id: `${side}-addend-${addend.id}`,
    data: {
      type: 'addend',
      side,
      nodeId: addend.id,
      latex: addend.latex,
      isConstant: addend.isConstant,
      parentProductId: addend.product?.id,
    },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `addend-${side}-${addend.id}`,
    data: {
      dropType: 'addend',
      side,
      nodeId: addend.id,
      isConstant: addend.isConstant,
    },
  });

  const assignContainerRef = (node: HTMLDivElement | null) => {
    setDropRef(node);
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };

  const signSymbol = addend.sign < 0 ? '−' : '+';
  const displaySign = showSign || addend.sign < 0;

  const handleToggle = () => {
    if (!addend.product) return;
    if (expanded) {
      onCollapseProduct(addend.product.id);
    } else {
      onToggleProduct(addend.product.id);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onNavigate('next');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onNavigate('prev');
    } else if (event.key === 'Enter' && addend.product) {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <div ref={assignContainerRef} className={`flex flex-col gap-2 ${isOver ? 'rounded-lg border border-accent/40 bg-accent/10 p-1' : ''}`}>
      <div
        ref={setDragRef}
        tabIndex={0}
        role="button"
        onKeyDown={handleKeyDown}
        onDoubleClick={handleToggle}
        className={`flex cursor-grab select-none items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-lg shadow-soft transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
          isDragging ? 'opacity-60 ring-2 ring-accent' : ''
        }`}
        {...listeners}
        {...attributes}
      >
        {displaySign ? <span className="text-xl font-semibold text-neutral">{signSymbol}</span> : null}
        <span className="text-neutral">
          <InlineMath math={addend.latex} />
        </span>
        {addend.product ? (
          <button
            type="button"
            onClick={handleToggle}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-slate-200"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        ) : null}
      </div>
      {addend.product && expanded ? (
        <ProductExpansion
          product={addend.product}
          side={side}
          onCollapse={() => onCollapseProduct(addend.product!.id)}
          onDivide={onDivide}
        />
      ) : null}
    </div>
  );
});

export default AddendChip;

interface ProductExpansionProps {
  product: ProductView;
  side: EquationSide;
  onCollapse: () => void;
  onDivide: (side: EquationSide, factorId: string) => void;
}

function ProductExpansion({ product, side, onCollapse, onDivide }: ProductExpansionProps) {
  const firstFactor = product.factors[0];
  const canDivide = Boolean(firstFactor?.isConstant);

  const handleBlur: React.FocusEventHandler<HTMLDivElement> = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      onCollapse();
    }
  };

  return (
    <div
      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base shadow-inner"
      tabIndex={-1}
      onBlur={handleBlur}
    >
      <div className="flex flex-wrap items-center gap-2">
        {product.factors.map((factor, index) => (
          <div key={factor.id} className="flex items-center gap-2">
            <FactorChip factor={factor} side={side} />
            {index < product.factors.length - 1 ? (
              <span className="text-sm text-slate-500">·</span>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={onCollapse}
          className="ml-auto rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
        >
          Collapse
        </button>
      </div>
      {canDivide && firstFactor ? (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onDivide(side, firstFactor.id);
              onCollapse();
            }}
            className="rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-soft hover:bg-orange-500"
          >
            ÷ <InlineMath math={firstFactor.latex} />
          </button>
          <span className="text-xs text-slate-500">Press Enter or tap to divide both sides.</span>
        </div>
      ) : null}
    </div>
  );
}
