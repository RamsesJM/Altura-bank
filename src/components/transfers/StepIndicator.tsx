interface StepIndicatorProps {
  current: number;
  total: number;
}

export function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-600">{`Step ${current} of ${total}`}</p>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index < current ? 'bg-brand-600' : 'bg-slate-200'}`}
          />
        ))}
      </div>
    </div>
  );
}
