import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

describe('AppLayout', () => {
  it('marks the current page in the main navigation', async () => {
    await seedSession();
    renderApp('/');

    const navigation = await screen.findByRole('navigation', { name: 'Main' });

    expect(within(navigation).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).getByRole('link', { name: 'Transactions' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('navigates to the transaction history', async () => {
    await seedSession();
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('link', { name: 'Transactions' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Transactions' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/transactions');
  });

  it('opens the history from the dashboard link', async () => {
    await seedSession();
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('link', { name: 'View all transactions' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Transactions' }),
    ).toBeInTheDocument();
  });

  it('signs out from the transaction history', async () => {
    await seedSession();
    const { user } = renderApp('/transactions');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByRole('heading', { name: 'Sign in to Altura Bank' }),
    ).toBeInTheDocument();
  });
});
