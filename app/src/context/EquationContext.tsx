import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { EquationPresent, EquationSide, EquationState } from '../domain/equation';
import {
  clearMessage as clearMessageState,
  combineConstantsOnSide,
  combineLikeTerms,
  combineProductConstants,
  distributeConstant,
  divideByLeadingFactor,
  moveConstantAcrossEquals,
  parseEquation,
  redo,
  toggleHelpers,
  undo,
} from '../domain/equation';

interface EquationContextValue {
  equation: EquationState | null;
  preview: EquationPresent | null;
  previewHint?: string;
  hoverMessage: string | null;
  loadEquation: (input: string) => { ok: boolean; error?: string };
  applyMoveConstant: (side: EquationSide, nodeId: string) => void;
  applyCombineLikeTerms: (side: EquationSide, sourceId: string, targetId: string) => void;
  applyCombineConstants: (side: EquationSide, sourceId: string, targetId: string) => void;
  applyCombineProductConstants: (side: EquationSide, sourceId: string, targetId: string) => void;
  applyDistribute: (side: EquationSide, factorId: string, groupId: string) => void;
  applyDivide: (side: EquationSide, factorId: string) => void;
  runPreview: (operation: (state: EquationState) => EquationState) => void;
  clearPreview: () => void;
  setHoverMessage: (message: string | null) => void;
  applyUndo: () => void;
  applyRedo: () => void;
  setHelpers: (enabled: boolean) => void;
  dismissMessage: () => void;
}

const EquationContext = createContext<EquationContextValue | undefined>(undefined);

export function EquationProvider({ children }: PropsWithChildren) {
  const [equation, setEquation] = useState<EquationState | null>(null);
  const [preview, setPreview] = useState<EquationPresent | null>(null);
  const [previewHint, setPreviewHint] = useState<string | undefined>();
  const [hoverMessage, setHoverMessage] = useState<string | null>(null);

  const loadEquation = useCallback((input: string) => {
    try {
      const next = parseEquation(input);
      setEquation(next);
      setPreview(null);
      setPreviewHint(undefined);
      setHoverMessage(null);
      return { ok: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to parse equation';
      return { ok: false as const, error: message };
    }
  }, []);

  const applyOperation = useCallback((operation: (state: EquationState) => EquationState) => {
    setEquation((current) => {
      if (!current) return current;
      const result = operation(current);
      if (result.past.length === current.past.length + 1) {
        setPreview(null);
        setPreviewHint(undefined);
        setHoverMessage(null);
      } else if (result.message) {
        setHoverMessage(result.message);
      }
      return result;
    });
  }, []);

  const runPreview = useCallback(
    (operation: (state: EquationState) => EquationState) => {
      setHoverMessage(null);
      setPreviewHint(undefined);
      if (!equation) {
        setPreview(null);
        return;
      }
      const result = operation(equation);
      if (result.past.length === equation.past.length + 1) {
        setPreview(result.present);
        setPreviewHint(result.hint);
      } else {
        setPreview(null);
        if (result.message) {
          setHoverMessage(result.message);
        }
      }
    },
    [equation],
  );

  const clearPreview = useCallback(() => {
    setPreview(null);
    setPreviewHint(undefined);
    setHoverMessage(null);
  }, []);

  const applyMoveConstant = useCallback(
    (side: EquationSide, nodeId: string) => applyOperation((state) => moveConstantAcrossEquals(state, side, nodeId)),
    [applyOperation],
  );

  const applyCombineLikeTerms = useCallback(
    (side: EquationSide, sourceId: string, targetId: string) =>
      applyOperation((state) => combineLikeTerms(state, side, sourceId, targetId)),
    [applyOperation],
  );

  const applyCombineConstants = useCallback(
    (side: EquationSide, sourceId: string, targetId: string) =>
      applyOperation((state) => combineConstantsOnSide(state, side, sourceId, targetId)),
    [applyOperation],
  );

  const applyCombineProductConstants = useCallback(
    (side: EquationSide, sourceId: string, targetId: string) =>
      applyOperation((state) => combineProductConstants(state, side, sourceId, targetId)),
    [applyOperation],
  );

  const applyDistribute = useCallback(
    (side: EquationSide, factorId: string, groupId: string) =>
      applyOperation((state) => distributeConstant(state, side, factorId, groupId)),
    [applyOperation],
  );

  const applyDivide = useCallback(
    (side: EquationSide, factorId: string) => applyOperation((state) => divideByLeadingFactor(state, side, factorId)),
    [applyOperation],
  );

  const applyUndo = useCallback(() => {
    setEquation((current) => (current ? undo(current) : current));
    clearPreview();
  }, [clearPreview]);

  const applyRedo = useCallback(() => {
    setEquation((current) => (current ? redo(current) : current));
    clearPreview();
  }, [clearPreview]);

  const setHelpers = useCallback(
    (enabled: boolean) => {
      setEquation((current) => (current ? toggleHelpers(current, enabled) : current));
    },
    [],
  );

  const dismissMessage = useCallback(() => {
    setEquation((current) => (current ? clearMessageState(current) : current));
    setHoverMessage(null);
  }, []);

  const value = useMemo<EquationContextValue>(
    () => ({
      equation,
      preview,
      previewHint,
      hoverMessage,
      loadEquation,
      applyMoveConstant,
      applyCombineLikeTerms,
      applyCombineConstants,
      applyCombineProductConstants,
      applyDistribute,
      applyDivide,
      runPreview,
      clearPreview,
      setHoverMessage,
      applyUndo,
      applyRedo,
      setHelpers,
      dismissMessage,
    }),
    [
      equation,
      preview,
      previewHint,
      hoverMessage,
      loadEquation,
      applyMoveConstant,
      applyCombineLikeTerms,
      applyCombineConstants,
      applyCombineProductConstants,
      applyDistribute,
      applyDivide,
      runPreview,
      clearPreview,
      setHoverMessage,
      applyUndo,
      applyRedo,
      setHelpers,
      dismissMessage,
    ],
  );

  return <EquationContext.Provider value={value}>{children}</EquationContext.Provider>;
}

export function useEquationContext() {
  const context = useContext(EquationContext);
  if (!context) {
    throw new Error('useEquationContext must be used within EquationProvider');
  }
  return context;
}
