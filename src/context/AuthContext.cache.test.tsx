import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../mocks/db';
import { server } from '../mocks/server';
import { queryKeys } from '../hooks/useBankingQueries';
import { getAccounts } from '../services/bankingService';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

describe('query cache and sessions', () => {
  it('clears cached banking data on sign out', async () => {
    await seedSession();
    const { user, queryClient } = renderApp('/');
    await screen.findByRole('heading', { name: 'Welcome back, Ramses' });

    await queryClient.fetchQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
    expect(queryClient.getQueryData(queryKeys.accounts)).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in to Altura Bank' });

    expect(queryClient.getQueryData(queryKeys.accounts)).toBeUndefined();
  });

  it('shows fresh data after signing back in', async () => {
    await seedSession();
    const { user } = renderApp('/');
    await screen.findByText('RD$145,230.50');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in to Altura Bank' });
    db.accounts[0].balance = 1000;
    await user.click(screen.getByRole('button', { name: 'Use demo account' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('RD$1,000.00')).toBeInTheDocument();
    expect(screen.queryByText('RD$145,230.50')).not.toBeInTheDocument();
  });

  it('signs out once when several requests expire together', async () => {
    const expired = () =>
      HttpResponse.json(
        { code: 'SESSION_EXPIRED', message: 'Your session has expired.' },
        { status: 401 },
      );
    server.use(
      http.get('/api/accounts', expired),
      http.get('/api/exchange-rate', expired),
      http.get('/api/transactions', expired),
    );
    await seedSession();
    const { queryClient } = renderApp('/');
    const clear = vi.spyOn(queryClient, 'clear');

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(clear).toHaveBeenCalledTimes(1);
  });
});
