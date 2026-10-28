import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { BrandLogo } from './BrandLogo';

interface NavigationItem {
  to: string;
  label: string;
  end: boolean;
  icon: ReactNode;
}

const iconProps = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'size-6',
} as const;

const navigation: NavigationItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg {...iconProps}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
      </svg>
    ),
  },
  {
    to: '/transactions',
    label: 'Transactions',
    end: false,
    icon: (
      <svg {...iconProps}>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </svg>
    ),
  },
  {
    to: '/transfers',
    label: 'Transfers',
    end: false,
    icon: (
      <svg {...iconProps}>
        <path d="M4 8h15l-4-4M20 16H5l4 4" />
      </svg>
    ),
  },
];

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <BrandLogo />
            <nav aria-label="Main" data-testid="nav-desktop" className="hidden sm:block">
              <ul className="flex gap-1">
                {navigation.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition ${focusRing} ${
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-600 md:inline">{user?.fullName}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className={`min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 ${focusRing}`}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        <Outlet />
      </div>
      <nav
        aria-label="Main"
        data-testid="nav-mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="grid grid-cols-3">
          {navigation.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition ${focusRing} ${
                    isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-900'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
