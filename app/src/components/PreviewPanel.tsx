import { InlineMath } from 'react-katex';
import type { EquationPresent, EquationState } from '../domain/equation';

interface PreviewPanelProps {
  preview: EquationPresent | null;
  hint?: string;
  equation: EquationState;
}

export default function PreviewPanel({ preview, hint, equation }: PreviewPanelProps) {
  if (!preview) {
    return null;
  }

  const latex = `${preview.left.toTex()} = ${preview.right.toTex()}`;

  return (
    <div className="rounded-xl border border-accent/30 bg-white/90 p-4 shadow-soft">
      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent">Preview</div>
      <div className="text-xl text-neutral">
        <InlineMath math={latex} />
      </div>
      <div className="mt-2 text-sm text-slate-600">{preview.note}</div>
      {equation.helpersEnabled && hint ? (
        <div className="mt-2 text-xs font-medium text-accent">{hint}</div>
      ) : null}
    </div>
  );
}
