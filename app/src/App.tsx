import { useEffect, useState } from 'react';
import { EquationProvider, useEquationContext } from './context/EquationContext';
import EquationWorkspace from './components/EquationWorkspace';
import StatusBar from './components/StatusBar';
import HistoryPanel from './components/HistoryPanel';

function AppShell() {
  const {
    equation,
    preview,
    previewHint,
    hoverMessage,
    loadEquation,
    applyUndo,
    applyRedo,
    setHelpers,
    dismissMessage,
  } = useEquationContext();
  const [input, setInput] = useState('2x + 5 = 7');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!equation) {
      const result = loadEquation(input);
      if (!result.ok) {
        setError(result.error ?? null);
      }
    }
  }, [equation, input, loadEquation]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = loadEquation(input);
    if (!result.ok) {
      setError(result.error ?? null);
    } else {
      setError(null);
    }
  };

  const message = hoverMessage ?? equation?.message ?? null;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-primary">Algebra Drag-Solve</h1>
          <p className="text-sm text-slate-600">
            Explore linear equations by dragging valid algebraic moves. Each action updates history, keeps grouping, and waits for you to simplify.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-soft">
          <label className="flex grow flex-col text-sm font-medium text-primary">
            Equation
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g. 2x + 5 = 7"
              aria-invalid={error ? 'true' : 'false'}
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-soft hover:bg-primary/90"
          >
            Parse
          </button>
          <button
            type="button"
            onClick={() => loadEquation('3(x+2) = 9')}
            className="rounded-lg border border-primary/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/10"
          >
            Load Sample
          </button>
        </form>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={applyUndo}
            disabled={!equation || equation.past.length === 0}
            className="rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={applyRedo}
            disabled={!equation || equation.future.length === 0}
            className="rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            Redo
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm font-medium text-primary">
            <input
              type="checkbox"
              checked={equation?.helpersEnabled ?? true}
              onChange={(event) => setHelpers(event.target.checked)}
            />
            Helpers
          </label>
        </div>

        {equation ? (
          <StatusBar
            note={equation.present.note}
            hint={preview ? previewHint ?? equation.hint : equation.hint}
            helpersEnabled={equation.helpersEnabled}
            previewNote={preview?.note}
          />
        ) : null}

        {message ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <span>{message}</span>
              <button
                type="button"
                onClick={dismissMessage}
                className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 hover:bg-amber-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <EquationWorkspace />

        {equation ? <HistoryPanel equation={equation} /> : null}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <EquationProvider>
      <AppShell />
    </EquationProvider>
  );
}
