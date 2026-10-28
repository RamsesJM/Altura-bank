import { BrandLogo } from './BrandLogo';

interface MockStartupErrorProps {
  onRetry: () => void;
}

export function MockStartupError({ onRetry }: MockStartupErrorProps) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <BrandLogo />
        <h1 className="mt-8 text-2xl font-semibold text-slate-900">This demo couldn't start</h1>
        <p className="mt-3 text-slate-600">
          Altura Bank runs a simulated banking server inside your browser, and this browser didn't
          allow it to start. Try again, or open the demo in Chrome, Edge, Safari or Firefox.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-8 w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
