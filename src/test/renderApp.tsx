import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../routes/AppRoutes';

interface RenderAppOptions {
  advanceTimers?: (ms: number) => unknown;
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

export function renderApp(route = '/', { advanceTimers }: RenderAppOptions = {}) {
  const user = userEvent.setup(advanceTimers ? { advanceTimers } : {});

  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <LocationDisplay />
    </MemoryRouter>,
  );

  return { user, ...result };
}
