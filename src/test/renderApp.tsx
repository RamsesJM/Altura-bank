import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../routes/AppRoutes';
import { createQueryClient } from '../services/queryClient';

interface RenderAppOptions {
  advanceTimers?: (ms: number) => unknown;
  history?: string[];
}

function LocationDisplay() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="location">{location.pathname + location.search}</div>
      <button type="button" onClick={() => void navigate(-1)}>
        Browser back
      </button>
    </>
  );
}

export function renderApp(route = '/', { advanceTimers, history = [] }: RenderAppOptions = {}) {
  const user = userEvent.setup(advanceTimers ? { advanceTimers } : {});
  const queryClient = createQueryClient({ retryDelay: 0 });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[...history, route]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user, queryClient, ...result };
}
