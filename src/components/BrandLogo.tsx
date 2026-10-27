interface BrandLogoProps {
  inverted?: boolean;
}

export function BrandLogo({ inverted = false }: BrandLogoProps) {
  return (
    <span
      className={`flex items-center gap-2.5 text-lg font-semibold ${inverted ? 'text-white' : 'text-brand-700'}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 place-items-center rounded-lg ${inverted ? 'bg-white text-brand-700' : 'bg-brand-700 text-white'}`}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
          <path d="M2 13 8 2l6 11h-3.5L8 8.2 5.5 13z" />
        </svg>
      </span>
      Altura Bank
    </span>
  );
}
