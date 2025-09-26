interface StatusBarProps {
  note: string;
  hint?: string;
  helpersEnabled: boolean;
  previewNote?: string;
}

export default function StatusBar({ note, hint, helpersEnabled, previewNote }: StatusBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary shadow-soft">
      <div>
        <div className="font-semibold">{previewNote ? `Next: ${previewNote}` : note}</div>
        {previewNote ? <div className="text-xs text-primary/70">Current: {note}</div> : null}
      </div>
      {helpersEnabled && hint ? <div className="text-xs font-medium text-primary/80">{hint}</div> : null}
    </div>
  );
}
