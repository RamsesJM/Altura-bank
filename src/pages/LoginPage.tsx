import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Alert } from '../components/Alert';
import { BrandLogo } from '../components/BrandLogo';
import { PasswordField } from '../components/PasswordField';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../config/demoAccount';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import { useCountdown } from '../hooks/useCountdown';
import { formatCountdown } from '../utils/format';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

type LoginError =
  | { type: 'credentials'; attemptsRemaining: number }
  | { type: 'locked'; announcedSeconds: number }
  | { type: 'message'; message: string };

const CONNECTION_MESSAGE = "We couldn't connect. Please try again.";

function toLoginError(error: unknown): LoginError {
  if (!(error instanceof ApiError)) return { type: 'message', message: CONNECTION_MESSAGE };

  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return { type: 'credentials', attemptsRemaining: error.attemptsRemaining ?? 0 };
    case 'ACCOUNT_LOCKED': {
      const remainingMs = error.lockedUntil ? Date.parse(error.lockedUntil) - Date.now() : 0;
      return { type: 'locked', announcedSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
    }
    case 'VALIDATION_ERROR':
      return { type: 'message', message: error.message };
    default:
      return { type: 'message', message: CONNECTION_MESSAGE };
  }
}

function describeError(error: LoginError, lockRemainingMs: number): ReactNode {
  switch (error.type) {
    case 'credentials': {
      const unit = error.attemptsRemaining === 1 ? 'attempt' : 'attempts';
      return `Incorrect email or password. ${error.attemptsRemaining} ${unit} remaining.`;
    }
    case 'locked':
      return (
        <>
          Account temporarily locked. Try again in{' '}
          <span aria-hidden="true">{formatCountdown(lockRemainingMs)}</span>
          <span className="sr-only">{error.announcedSeconds} seconds</span>.
        </>
      );
    case 'message':
      return error.message;
  }
}

const highlights = [
  'Sessions protected with automatic sign-out',
  'Account lock after repeated failed attempts',
  'Balances and transfers in BOB and USD',
];

export function LoginPage() {
  const { login, sessionExpired } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<LoginError | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const lockRemainingMs = useCountdown(lockedUntil);
  const isLocked = lockedUntil !== null && lockRemainingMs > 0;

  useEffect(() => {
    if (lockedUntil !== null && lockRemainingMs === 0) {
      setLockedUntil(null);
      setError(null);
    }
  }, [lockedUntil, lockRemainingMs]);

  function updateEmail(value: string) {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
  }

  function updatePassword(value: string) {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
  }

  function fillDemoAccount() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || isLocked) return;

    const normalizedEmail = email.trim();
    const errors: FieldErrors = {};
    if (!EMAIL_PATTERN.test(normalizedEmail)) errors.email = 'Enter a valid email address';
    if (!password) errors.password = 'Enter your password';

    setFieldErrors(errors);
    if (errors.email || errors.password) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await login(normalizedEmail, password);
    } catch (caught) {
      setError(toLoginError(caught));
      if (caught instanceof ApiError && caught.code === 'ACCOUNT_LOCKED' && caught.lockedUntil) {
        setLockedUntil(Date.parse(caught.lockedUntil));
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <BrandLogo inverted />
        <div>
          <h2 className="max-w-md text-4xl leading-tight font-semibold">
            Banking that keeps up with you.
          </h2>
          <ul className="mt-8 space-y-3 text-brand-100">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-100" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-brand-100">Altura Bank is a fictional bank for demo purposes.</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandLogo />
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">Sign in to Altura Bank</h1>
          <p className="mt-1 text-sm text-slate-500">Access your accounts securely.</p>

          <div className="mt-6 space-y-3">
            {sessionExpired && !error && (
              <Alert variant="info">Your session has expired. Please sign in again.</Alert>
            )}
            {error && <Alert variant="error">{describeError(error, lockRemainingMs)}</Alert>}
          </div>

          <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => updateEmail(event.target.value)}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                className={`mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:ring-2 ${
                  fieldErrors.email
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
                }`}
              />
              {fieldErrors.email && (
                <p id="email-error" className="mt-1.5 text-sm text-red-700">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <PasswordField
              value={password}
              onChange={updatePassword}
              error={fieldErrors.password}
              inputRef={passwordRef}
            />

            <button
              type="submit"
              disabled={isSubmitting || isLocked}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <h2 className="font-medium text-slate-900">Demo account</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-600">
              <dt>Email</dt>
              <dd className="font-mono">{DEMO_EMAIL}</dd>
              <dt>Password</dt>
              <dd className="font-mono">{DEMO_PASSWORD}</dd>
            </dl>
            <button
              type="button"
              onClick={fillDemoAccount}
              className="mt-3 font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              Use demo account
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
