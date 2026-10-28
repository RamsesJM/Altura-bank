import { type FormEvent, type ReactNode, useId, useState } from 'react';

interface OtpStepProps {
  busy: boolean;
  message?: ReactNode;
  onSubmit: (code: string) => void;
}

export function OtpStep({ busy, message, onSubmit }: OtpStepProps) {
  const id = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!/^\d{6}$/.test(value)) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(null);
    onSubmit(value);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-slate-600">
        We sent a 6-digit code to the phone linked to your account.
      </p>
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
        Demo code: 123456
      </p>

      <div>
        <label htmlFor={`${id}-code`} className="block text-sm font-medium text-slate-700">
          Verification code
        </label>
        <input
          id={`${id}-code`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`mt-1.5 block min-h-11 w-40 rounded-lg border bg-white px-3 py-2 font-mono tracking-widest text-slate-900 outline-none transition focus:ring-2 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
          }`}
        />
        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {message}

      <button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-brand-600 px-4 font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Confirm transfer
      </button>
    </form>
  );
}
