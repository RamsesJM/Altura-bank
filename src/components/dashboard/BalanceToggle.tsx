interface BalanceToggleProps {
  hidden: boolean;
  onToggle: () => void;
}

export function BalanceToggle({ hidden, onToggle }: BalanceToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={hidden}
      onClick={onToggle}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="M4 4l16 16" />}
      </svg>
      <span>Hide balances</span>
    </button>
  );
}
