import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { db } from '../mocks/db';
import { server } from '../mocks/server';
import { filterTransactions, paginate } from '../mocks/transactionQuery';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

async function renderHistory(route = '/transactions') {
  await seedSession();
  const utils = renderApp(route);
  await screen.findByRole('heading', { level: 1, name: 'Transactions' });
  return utils;
}

const list = () => screen.getByRole('region', { name: 'All transactions' });
const dataRows = async () => (await within(list()).findAllByRole('row')).slice(1);
const total = () => db.transactions.length;
const lastPage = () => Math.ceil(total() / 10);

describe('TransactionsPage', () => {
  it('shows the first ten transactions with a summary', async () => {
    await renderHistory();

    expect(await dataRows()).toHaveLength(10);
    expect(screen.getByText(`Showing 1–10 of ${total()} transactions`)).toBeInTheDocument();
  });

  it('moves to the next page and keeps it in the URL', async () => {
    const { user } = await renderHistory();
    await dataRows();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText(`Showing 11–20 of ${total()} transactions`)).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/transactions?page=2');
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'All transactions' })).toHaveFocus();

    const expected = paginate(filterTransactions(db.transactions, {}), 2, 10).items[0];
    expect((await dataRows())[0]).toHaveTextContent(expected.description);
  });

  it('disables Previous on the first page', async () => {
    await renderHistory();
    await dataRows();

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('ignores invalid values in the URL', async () => {
    await renderHistory('/transactions?page=abc&type=foo&from=bad');

    expect(await screen.findByText(`Showing 1–10 of ${total()} transactions`)).toBeInTheDocument();
  });

  it('moves to the last page when the URL asks for one beyond the end', async () => {
    await renderHistory('/transactions?page=9');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(`page=${lastPage()}`),
    );
    const start = (lastPage() - 1) * 10 + 1;
    expect(
      await screen.findByText(`Showing ${start}–${total()} of ${total()} transactions`),
    ).toBeInTheDocument();
  });

  it('marks the list as busy while loading', async () => {
    server.use(
      http.get('/api/transactions', async () => {
        await delay(50);
        return HttpResponse.json({
          transactions: [],
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
        });
      }),
    );
    await renderHistory();

    expect(list()).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(list()).toHaveAttribute('aria-busy', 'false'));
  });

  it('retries after an error', async () => {
    let calls = 0;
    server.use(
      http.get('/api/transactions', () => {
        calls += 1;
        if (calls <= 2) return HttpResponse.json({}, { status: 500 });
        return HttpResponse.json({
          transactions: db.transactions.slice(0, 10),
          page: 1,
          pageSize: 10,
          total: 10,
          totalPages: 1,
        });
      }),
    );
    const { user } = await renderHistory();

    expect(await screen.findByText("We couldn't load your transactions.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await dataRows()).toHaveLength(10);
  });

  it('hides amounts when balances are hidden', async () => {
    localStorage.setItem('altura.hideBalances', 'true');
    await renderHistory();
    await dataRows();

    expect(list().textContent).not.toMatch(/(RD|US)\$\d/);
    expect(within(list()).getAllByText(/RD\$ ••••••|US\$ ••••••/).length).toBeGreaterThan(0);
  });

  it('keeps an earlier page when the user goes back to it', async () => {
    await seedSession();
    const { user } = renderApp('/transactions?type=credit', { history: ['/transactions?page=3'] });
    await screen.findByText(/^Showing 1–/);

    await user.click(screen.getByRole('button', { name: 'Browser back' }));

    expect(
      await screen.findByText(`Showing 21–${Math.min(30, total())} of ${total()} transactions`),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/transactions?page=3');
  });

  it('replaces a page beyond the end so going back skips it', async () => {
    await seedSession();
    const { user } = renderApp('/transactions?page=9', { history: ['/transactions'] });
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(`page=${lastPage()}`),
    );

    await user.click(screen.getByRole('button', { name: 'Browser back' }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/transactions'));
  });
});
