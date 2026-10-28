import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../routes/AppRoutes';
import { createQueryClient } from '../services/queryClient';

interface RenderAppOptions {
  advanceTimers?: (ms: number) => unknown;
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

export function renderApp(route = '/', { advanceTimers }: RenderAppOptions = {}) {
  const user = userEvent.setup(advanceTimers ? { advanceTimers } : {});
  const queryClient = createQueryClient({ retryDelay: 0 });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user, queryClient, ...result };
}
