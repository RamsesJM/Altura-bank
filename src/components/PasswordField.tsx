import { useState, type Ref } from 'react';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function PasswordField({ value, onChange, error, inputRef }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor="password" className="block text-sm font-medium text-slate-700">
        Password
      </label>
      <div className="relative mt-1.5">
        <input
          ref={inputRef}
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'password-error' : undefined}
          className={`block w-full rounded-lg border bg-white px-3 py-2.5 pr-11 text-slate-900 outline-none transition focus:ring-2 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
          }`}
        />
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600"
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
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {error && (
        <p id="password-error" className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
