interface SectionErrorProps {
  message: string;
  onRetry: () => void;
  inverted?: boolean;
}

export function SectionError({ message, onRetry, inverted = false }: SectionErrorProps) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
      <p className={inverted ? 'text-brand-100' : 'text-slate-600'}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`min-h-11 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
          inverted
            ? 'bg-white text-brand-700 hover:bg-brand-50 focus-visible:outline-white'
            : 'border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:outline-brand-600'
        }`}
      >
        Try again
      </button>
    </div>
  );
}
