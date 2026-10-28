import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../mocks/db';
import { server } from '../mocks/server';
import { filterTransactions } from '../mocks/transactionQuery';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';
import type { TransactionFilters } from '../types/banking';
import { bankDateKey } from '../utils/dates';

const { saveBlob } = vi.hoisted(() => ({ saveBlob: vi.fn() }));
vi.mock('../utils/download', () => ({ saveBlob }));

const DAY_MS = 86_400_000;

async function renderHistory(route = '/transactions') {
  await seedSession();
  const utils = renderApp(route);
  await screen.findByRole('heading', { level: 1, name: 'Transactions' });
  return utils;
}

const list = () => screen.getByRole('region', { name: 'All transactions' });
const count = (filters: TransactionFilters) => filterTransactions(db.transactions, filters).length;
const summary = (total: number) => `Showing 1–${Math.min(10, total)} of ${total} transactions`;

describe('TransactionsPage filters and export', () => {
  afterEach(() => {
    saveBlob.mockReset();
  });

  it('filters by account', async () => {
    const { user } = await renderHistory();

    await screen.findByRole('option', { name: /Savings USD/ });
    await user.selectOptions(screen.getByLabelText('Account'), 'acc-usd-savings');

    expect(
      await screen.findByText(summary(count({ accountId: 'acc-usd-savings' }))),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('account=acc-usd-savings');
  });

  it('shows only credits', async () => {
    const { user } = await renderHistory();

    await user.selectOptions(screen.getByLabelText('Type'), 'credit');

    expect(await screen.findByText(summary(count({ type: 'credit' })))).toBeInTheDocument();
    const rows = within(list()).getAllByRole('row').slice(1);
    for (const row of rows) expect(row).toHaveTextContent('Credit');
  });

  it('filters by date range', async () => {
    await renderHistory();
    const from = bankDateKey(new Date(Date.now() - 10 * DAY_MS).toISOString());
    const to = bankDateKey(new Date().toISOString());

    fireEvent.change(screen.getByLabelText('From'), { target: { value: from } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: to } });

    expect(await screen.findByText(summary(count({ from, to })))).toBeInTheDocument();
  });

  it('searches descriptions after the user stops typing', async () => {
    const { user } = await renderHistory();

    await user.type(screen.getByLabelText('Search transactions'), 'netflix');

    expect(await screen.findByText(summary(count({ q: 'netflix' })))).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('q=netflix');
  });

  it('goes back to the first page when a filter changes', async () => {
    const { user } = await renderHistory('/transactions?page=2');
    await screen.findByText(/Showing 11–20/);

    await user.selectOptions(screen.getByLabelText('Type'), 'debit');

    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('page='));
  });

  it('clears filters from the empty state', async () => {
    const { user } = await renderHistory('/transactions?q=zzzz');

    expect(await screen.findByText('No transactions match your filters.')).toBeInTheDocument();
    await user.click(within(list()).getByRole('button', { name: 'Clear filters' }));

    expect(
      await screen.findByText(`Showing 1–10 of ${db.transactions.length} transactions`),
    ).toBeInTheDocument();
  });

  it('explains an inverted date range', async () => {
    await renderHistory();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });

    expect(
      await screen.findByText('The start date must be before the end date.'),
    ).toBeInTheDocument();
  });

  it('exports the filtered transactions as CSV', async () => {
    const { user } = await renderHistory('/transactions?type=credit');
    await screen.findByText(summary(count({ type: 'credit' })));

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(saveBlob).toHaveBeenCalledOnce());
    const [blob, fileName] = saveBlob.mock.calls[0] as [Blob, string];
    const lines = (await blob.text()).split('\r\n');

    expect(fileName).toBe(`altura-transactions-${bankDateKey(new Date().toISOString())}.csv`);
    expect(lines[0]).toBe('Date,Description,Account,Type,Amount,Currency');
    expect(lines).toHaveLength(count({ type: 'credit' }) + 1);
  });

  it('exports only the header when nothing matches', async () => {
    const { user } = await renderHistory('/transactions?q=zzzz');
    await screen.findByText('No transactions match your filters.');

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(saveBlob).toHaveBeenCalledOnce());
    const [blob] = saveBlob.mock.calls[0] as [Blob, string];
    expect(await blob.text()).toBe('Date,Description,Account,Type,Amount,Currency');
  });

  it('reports a failed export', async () => {
    server.use(http.get('/api/transactions/export', () => HttpResponse.json({}, { status: 500 })));
    const { user } = await renderHistory();

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByText('Export failed. Please try again.')).toBeInTheDocument();
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it('discards a pending search when filters are cleared', async () => {
    const { user } = await renderHistory('/transactions?type=debit');

    await user.type(screen.getByLabelText('Search transactions'), 'uber');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.getByTestId('location').textContent).toBe('/transactions');
    expect(screen.getByLabelText('Search transactions')).toHaveValue('');
  });

  it('keeps spaces typed in the search box', async () => {
    const { user } = await renderHistory();
    const search = screen.getByLabelText('Search transactions');

    await user.type(search, 'netflix ');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('q=netflix'));
    expect(search).toHaveValue('netflix ');
  });

  it('ignores an unknown account in the URL', async () => {
    await renderHistory('/transactions?account=bogus');

    expect(
      await screen.findByText(`Showing 1–10 of ${db.transactions.length} transactions`),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Account')).toHaveValue('');
    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('account='));
  });

  it('exports the search being typed', async () => {
    const { user } = await renderHistory();
    await screen.findByText(summary(db.transactions.length));

    await user.type(screen.getByLabelText('Search transactions'), 'netflix');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(saveBlob).toHaveBeenCalledOnce());
    const [blob] = saveBlob.mock.calls[0] as [Blob, string];
    expect((await blob.text()).split('\r\n')).toHaveLength(count({ q: 'netflix' }) + 1);
  });

  it('shows Clear filters only when a filter is active', async () => {
    await renderHistory();
    await screen.findByText(summary(db.transactions.length));

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows Clear filters when a filter is set', async () => {
    await renderHistory('/transactions?type=credit');
    await screen.findByText(summary(count({ type: 'credit' })));

    expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(1);
  });
});
