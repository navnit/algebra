import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { InlineMath } from 'react-katex';
import type { EquationSide, EquationState } from '../domain/equation';
import { useEquationContext } from '../context/EquationContext';
import { buildAddendViews } from '../utils/equationView';
import EquationSideView from './EquationSideView';
import EqualsDropZone from './EqualsDropZone';
import PreviewPanel from './PreviewPanel';
import {
  combineConstantsOnSide as simulateCombineConstants,
  combineLikeTerms as simulateCombineLikeTerms,
  combineProductConstants as simulateCombineProductConstants,
  distributeConstant as simulateDistribute,
  divideByLeadingFactor as simulateDivide,
  moveConstantAcrossEquals as simulateMoveConstant,
} from '../domain/equation';

interface ActiveDragData {
  type: 'addend' | 'factor';
  side: EquationSide;
  nodeId: string;
  latex: string;
  isConstant: boolean;
  parentProductId?: string;
}

interface DropMetadata {
  dropType: 'addend' | 'factor' | 'group' | 'equals';
  side?: EquationSide;
  nodeId?: string;
  isConstant?: boolean;
  parentProductId?: string;
}

export default function EquationWorkspace() {
  const {
    equation,
    preview,
    previewHint,
    runPreview,
    clearPreview,
    setHoverMessage,
    applyMoveConstant,
    applyCombineLikeTerms,
    applyCombineConstants,
    applyCombineProductConstants,
    applyDistribute,
    applyDivide,
  } = useEquationContext();
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [activeDrag, setActiveDrag] = useState<ActiveDragData | null>(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  if (!equation) {
    return (
      <div className="rounded-xl border border-slate-300 bg-white/60 p-8 text-center text-slate-500 shadow-soft">
        Enter an equation to begin exploring algebraic moves.
      </div>
    );
  }

  const present = equation.present;
  const leftAddends = buildAddendViews(present.left);
  const rightAddends = buildAddendViews(present.right);

  const handleToggleProduct = (productId: string) => {
    setExpandedProducts((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const handleCollapseProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      if (!prev[productId]) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as ActiveDragData | undefined;
    if (data) {
      setActiveDrag(data);
      setHoverMessage(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const data = event.active.data.current as ActiveDragData | undefined;
    const overData = event.over?.data.current as DropMetadata | undefined;
    if (!data || !equation) {
      clearPreview();
      return;
    }
    const operation = resolvePreviewOperation(data, overData);
    if (operation) {
      runPreview(operation);
    } else {
      clearPreview();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as ActiveDragData | undefined;
    const overData = event.over?.data.current as DropMetadata | undefined;
    if (data) {
      const applied = resolveApplyOperation(data, overData, {
        applyMoveConstant,
        applyCombineLikeTerms,
        applyCombineConstants,
        applyCombineProductConstants,
        applyDistribute,
        applyDivide,
      });
      if (applied) {
        applied();
        if (data.parentProductId) {
          handleCollapseProduct(data.parentProductId);
        }
      } else if (event.over) {
        setHoverMessage("That step isn't valid here");
      }
    }
    setActiveDrag(null);
    clearPreview();
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
    clearPreview();
  };

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex items-start gap-6 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-soft">
          <EquationSideView
            title="Left"
            side="left"
            addends={leftAddends}
            expandedProducts={expandedProducts}
            onToggleProduct={handleToggleProduct}
            onCollapseProduct={handleCollapseProduct}
            onDivide={applyDivide}
          />
          <EqualsDropZone />
          <EquationSideView
            title="Right"
            side="right"
            addends={rightAddends}
            expandedProducts={expandedProducts}
            onToggleProduct={handleToggleProduct}
            onCollapseProduct={handleCollapseProduct}
            onDivide={applyDivide}
          />
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="rounded-full border border-accent bg-white px-3 py-1 text-lg font-medium text-accent shadow-soft">
              <InlineMath math={activeDrag.latex} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <PreviewPanel preview={preview} hint={previewHint} equation={equation} />
    </div>
  );
}
function resolvePreviewOperation(active: ActiveDragData, over?: DropMetadata | null) {
  if (!over) return null;
  if (over.dropType === 'equals' && active.type === 'addend' && active.isConstant) {
    if (active.side === 'left' && over.side === 'right') {
      return (state: EquationState) => simulateMoveConstant(state, 'left', active.nodeId);
    }
    if (active.side === 'right' && over.side === 'left') {
      return (state: EquationState) => simulateMoveConstant(state, 'right', active.nodeId);
    }
  }
  if (over.dropType === 'equals' && active.type === 'factor' && active.isConstant) {
    if (active.side === 'left' && over.side === 'right') {
      return (state: EquationState) => simulateDivide(state, 'left', active.nodeId);
    }
    if (active.side === 'right' && over.side === 'left') {
      return (state: EquationState) => simulateDivide(state, 'right', active.nodeId);
    }
  }
  if (
    over.dropType === 'addend' &&
    active.type === 'addend' &&
    over.side === active.side &&
    over.nodeId &&
    active.nodeId !== over.nodeId
  ) {
    if (active.isConstant && over.isConstant) {
      return (state: EquationState) => simulateCombineConstants(state, active.side, active.nodeId, over.nodeId!);
    }
    return (state: EquationState) => simulateCombineLikeTerms(state, active.side, active.nodeId, over.nodeId!);
  }
  if (
    over.dropType === 'factor' &&
    active.type === 'factor' &&
    active.side === over.side &&
    over.parentProductId === active.parentProductId &&
    active.nodeId !== over.nodeId &&
    active.isConstant &&
    over.isConstant
  ) {
    return (state: EquationState) => simulateCombineProductConstants(state, active.side, active.nodeId, over.nodeId!);
  }
  if (
    over.dropType === 'group' &&
    active.type === 'factor' &&
    active.isConstant &&
    active.side === over.side &&
    over.parentProductId === active.parentProductId &&
    over.nodeId
  ) {
    return (state: EquationState) => simulateDistribute(state, active.side, active.nodeId, over.nodeId!);
  }
  return null;
}

interface ApplyFns {
  applyMoveConstant: (side: EquationSide, nodeId: string) => void;
  applyCombineLikeTerms: (side: EquationSide, sourceId: string, targetId: string) => void;
  applyCombineConstants: (side: EquationSide, sourceId: string, targetId: string) => void;
  applyCombineProductConstants: (side: EquationSide, sourceId: string, targetId: string) => void;
  applyDistribute: (side: EquationSide, factorId: string, groupId: string) => void;
  applyDivide: (side: EquationSide, factorId: string) => void;
}

function resolveApplyOperation(
  active: ActiveDragData,
  over: DropMetadata | null | undefined,
  fns: ApplyFns,
) {
  if (!over) return null;
  if (over.dropType === 'equals' && active.type === 'addend' && active.isConstant) {
    if (active.side === 'left' && over.side === 'right') {
      return () => fns.applyMoveConstant('left', active.nodeId);
    }
    if (active.side === 'right' && over.side === 'left') {
      return () => fns.applyMoveConstant('right', active.nodeId);
    }
  }
  if (over.dropType === 'equals' && active.type === 'factor' && active.isConstant) {
    if (active.side === 'left' && over.side === 'right') {
      return () => fns.applyDivide('left', active.nodeId);
    }
    if (active.side === 'right' && over.side === 'left') {
      return () => fns.applyDivide('right', active.nodeId);
    }
  }
  if (
    over.dropType === 'addend' &&
    active.type === 'addend' &&
    active.side === over.side &&
    over.nodeId &&
    active.nodeId !== over.nodeId
  ) {
    if (active.isConstant && over.isConstant) {
      return () => fns.applyCombineConstants(active.side, active.nodeId, over.nodeId!);
    }
    return () => fns.applyCombineLikeTerms(active.side, active.nodeId, over.nodeId!);
  }
  if (
    over.dropType === 'factor' &&
    active.type === 'factor' &&
    active.side === over.side &&
    over.parentProductId === active.parentProductId &&
    active.nodeId !== over.nodeId &&
    active.isConstant &&
    over.isConstant
  ) {
    return () => fns.applyCombineProductConstants(active.side, active.nodeId, over.nodeId!);
  }
  if (
    over.dropType === 'group' &&
    active.type === 'factor' &&
    active.isConstant &&
    active.side === over.side &&
    over.parentProductId === active.parentProductId &&
    over.nodeId
  ) {
    return () => fns.applyDistribute(active.side, active.nodeId, over.nodeId!);
  }
  return null;
}
