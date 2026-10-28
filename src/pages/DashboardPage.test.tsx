import { act, screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { queryKeys } from '../hooks/useBankingQueries';
import { db } from '../mocks/db';
import { server } from '../mocks/server';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

async function renderDashboard() {
  await seedSession();
  const utils = renderApp('/');
  await screen.findByRole('heading', { name: 'Welcome back, Ramses' });
  return utils;
}

const section = (name: string) => screen.getByRole('region', { name });

function latestTransactions(limit: number) {
  return [...db.transactions]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, limit);
}

describe('DashboardPage', () => {
  it('shows skeletons and then the dashboard data', async () => {
    server.use(
      http.get('/api/accounts', async () => {
        await delay(50);
        return HttpResponse.json({ accounts: db.accounts });
      }),
    );
    await renderDashboard();

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(await screen.findByText('RD$327,166.62')).toBeInTheDocument();

    const accounts = section('Your accounts');
    expect(within(accounts).getByText('RD$145,230.50')).toBeInTheDocument();
    expect(within(accounts).getByText('RD$38,940.00')).toBeInTheDocument();
    expect(within(accounts).getByText('US$2,350.75')).toBeInTheDocument();
    expect(
      screen.getByText('USD converted at RD$60.83 · Reference rate Oct 23, 2026'),
    ).toBeInTheDocument();
  });

  it('masks account numbers with an accessible label', async () => {
    await renderDashboard();

    const accounts = await screen.findByRole('region', { name: 'Your accounts' });
    expect(await within(accounts).findByLabelText('account ending in 4521')).toHaveTextContent(
      '**** 4521',
    );
    expect(within(accounts).getByText('Checking account')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('2004587214521');
  });

  it('shows the five most recent transactions', async () => {
    await renderDashboard();

    const items = await within(section('Recent transactions')).findAllByRole('listitem');

    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent(latestTransactions(1)[0].description);
    for (const item of items) {
      expect(item.textContent).toMatch(/Credit|Debit/);
    }
  });

  it('shows an empty message without transactions', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json({ transactions: [] })));
    await renderDashboard();

    expect(await screen.findByText('No recent transactions.')).toBeInTheDocument();
  });

  it('retries a failed section with Try again', async () => {
    let calls = 0;
    server.use(
      http.get('/api/transactions', () => {
        calls += 1;
        if (calls <= 2) return HttpResponse.json({}, { status: 500 });
        return HttpResponse.json({ transactions: latestTransactions(5) });
      }),
    );
    const { user } = await renderDashboard();

    expect(await screen.findByText("We couldn't load your transactions.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await within(section('Recent transactions')).findAllByRole('listitem')).toHaveLength(5);
  });

  it('keeps accounts visible when the exchange rate fails', async () => {
    server.use(http.get('/api/exchange-rate', () => HttpResponse.json({}, { status: 500 })));
    await renderDashboard();

    expect(await screen.findByText("We couldn't load the exchange rate.")).toBeInTheDocument();
    expect(within(section('Your accounts')).getByText('US$2,350.75')).toBeInTheDocument();
  });

  it('signs out when the session expires while loading', async () => {
    let calls = 0;
    server.use(
      http.get('/api/accounts', () => {
        calls += 1;
        return HttpResponse.json(
          { code: 'SESSION_EXPIRED', message: 'Your session has expired.' },
          { status: 401 },
        );
      }),
    );
    await seedSession();
    renderApp('/');

    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('hides every amount when balances are hidden', async () => {
    const { user } = await renderDashboard();
    await screen.findByText('RD$327,166.62');
    const items = await within(section('Recent transactions')).findAllByRole('listitem');

    await user.click(screen.getByRole('button', { name: 'Hide balances' }));

    for (const amount of ['RD$327,166.62', 'RD$145,230.50', 'RD$38,940.00', 'US$2,350.75']) {
      expect(screen.queryByText(amount)).not.toBeInTheDocument();
    }
    for (const item of items) {
      expect(item.textContent).not.toMatch(/[+−](RD|US)\$\d/);
    }
    expect(screen.getAllByText('RD$ ••••••').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Hide balances' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('remembers hidden balances after a reload', async () => {
    const { user, unmount } = await renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Hide balances' }));
    unmount();

    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Hide balances' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows dollar transactions in dollars even when accounts fail to load', async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.json({}, { status: 500 })));
    await renderDashboard();

    const recent = await screen.findByRole('region', { name: 'Recent transactions' });
    const netflix = (await within(recent).findByText('Netflix subscription')).closest('li');

    expect(netflix).toHaveTextContent('US$15.49');
    expect(netflix).not.toHaveTextContent('RD$15.49');
  });

  it('keeps loaded data on screen when a background refresh fails', async () => {
    const { queryClient } = await renderDashboard();
    await screen.findByText('RD$327,166.62');
    await within(section('Recent transactions')).findAllByRole('listitem');

    server.use(
      http.get('/api/accounts', () => HttpResponse.json({}, { status: 500 })),
      http.get('/api/transactions', () => HttpResponse.json({}, { status: 500 })),
    );
    await act(async () => {
      await queryClient.refetchQueries();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(queryClient.getQueryState(queryKeys.accounts)?.status).toBe('error');
    expect(queryClient.getQueryState(queryKeys.transactions(5))?.status).toBe('error');
    expect(screen.getByText('RD$327,166.62')).toBeInTheDocument();
    expect(within(section('Your accounts')).getByText('US$2,350.75')).toBeInTheDocument();
    expect(within(section('Recent transactions')).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByText("We couldn't load your accounts.")).not.toBeInTheDocument();
    expect(screen.queryByText("We couldn't load your transactions.")).not.toBeInTheDocument();
  });

  it('keeps the visible toggle label equal to its accessible name', async () => {
    const { user } = await renderDashboard();
    const toggle = screen.getByRole('button', { name: 'Hide balances' });

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent('Hide balances');
    expect(toggle).not.toHaveTextContent('Show balances');
  });

  it('marks loading sections as busy', async () => {
    server.use(
      http.get('/api/accounts', async () => {
        await delay(50);
        return HttpResponse.json({ accounts: db.accounts });
      }),
    );
    await renderDashboard();

    expect(section('Your accounts')).toHaveAttribute('aria-busy', 'true');
    await within(section('Your accounts')).findByText('US$2,350.75');
    expect(section('Your accounts')).toHaveAttribute('aria-busy', 'false');
  });
});
