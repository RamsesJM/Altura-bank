import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../hooks/useAuth';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function DashboardPage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-600 sm:inline">{user.fullName}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user.lastLoginAt
            ? `Last login: ${dateFormatter.format(new Date(user.lastLoginAt))}`
            : 'This is your first sign-in'}
        </p>
      </main>
    </div>
  );
}
