import { InlineMath } from 'react-katex';
import type { EquationState } from '../domain/equation';

interface HistoryPanelProps {
  equation: EquationState;
}

export default function HistoryPanel({ equation }: HistoryPanelProps) {
  const entries = [...equation.past, equation.present];

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-soft">
      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Step history</div>
      <ol className="space-y-3 text-sm text-neutral">
        {entries.map((entry, index) => {
          const latex = `${entry.left.toTex()} = ${entry.right.toTex()}`;
          const isCurrent = index === entries.length - 1;
          return (
            <li key={`${entry.note}-${index}`} className={isCurrent ? 'rounded-lg bg-primary/5 p-3 shadow-inner' : 'p-3'}>
              <div className="font-medium text-primary">{isCurrent ? `Current: ${entry.note}` : entry.note}</div>
              <div className="mt-1 text-base">
                <InlineMath math={latex} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
