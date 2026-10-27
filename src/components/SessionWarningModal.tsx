import { useEffect, useRef } from 'react';
import { formatCountdown } from '../utils/format';

const ANNOUNCED_SECONDS = [60, 30, 10];

interface SessionWarningModalProps {
  remainingMs: number;
  onStay: () => void;
  onSignOut: () => void;
}

export function SessionWarningModal({ remainingMs, onStay, onSignOut }: SessionWarningModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const seconds = Math.ceil(remainingMs / 1000);
  const announcement = ANNOUNCED_SECONDS.includes(seconds)
    ? `You will be signed out in ${seconds} seconds.`
    : '';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="session-warning-title"
      onCancel={(event) => event.preventDefault()}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-900/50"
    >
      <h2 id="session-warning-title" className="text-lg font-semibold text-slate-900">
        Your session is about to expire
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        For your security, you will be signed out in{' '}
        <strong className="font-mono text-slate-900">{formatCountdown(remainingMs)}</strong>.
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={onStay}
          autoFocus
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Stay signed in
        </button>
      </div>
    </dialog>
  );
}
