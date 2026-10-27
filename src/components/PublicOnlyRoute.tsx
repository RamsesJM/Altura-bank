import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { FullScreenLoader } from './FullScreenLoader';

export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') return <Navigate to={from} replace />;

  return <Outlet />;
}
