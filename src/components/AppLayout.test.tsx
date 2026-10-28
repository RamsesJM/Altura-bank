import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

describe('AppLayout', () => {
  it('marks the current page in both navigation bars', async () => {
    await seedSession();
    renderApp('/');

    const navigations = await screen.findAllByRole('navigation', { name: 'Main' });

    expect(navigations).toHaveLength(2);
    for (const navigation of navigations) {
      expect(within(navigation).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(navigation).getByRole('link', { name: 'Transactions' })).not.toHaveAttribute(
        'aria-current',
      );
    }
  });

  it('shows the bottom bar on phones and the top navigation from sm up', async () => {
    await seedSession();
    renderApp('/');

    expect(await screen.findByTestId('nav-mobile')).toHaveClass('sm:hidden');
    expect(screen.getByTestId('nav-desktop')).toHaveClass('hidden', 'sm:block');
  });

  it('lists the same three destinations in both bars', async () => {
    await seedSession();
    renderApp('/');

    for (const testId of ['nav-desktop', 'nav-mobile']) {
      const links = within(await screen.findByTestId(testId)).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([
        'Dashboard',
        'Transactions',
        'Transfers',
      ]);
    }
  });

  it('navigates to the transaction history', async () => {
    await seedSession();
    const { user } = renderApp('/');

    await user.click(
      within(await screen.findByTestId('nav-mobile')).getByRole('link', { name: 'Transactions' }),
    );

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

  it('marks Transfers as the current page on /transfers', async () => {
    await seedSession();
    renderApp('/transfers');

    const navigations = await screen.findAllByRole('navigation', { name: 'Main' });

    expect(navigations).toHaveLength(2);
    for (const navigation of navigations) {
      expect(within(navigation).getByRole('link', { name: 'Transfers' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  it('opens transfers from the dashboard', async () => {
    await seedSession();
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('link', { name: 'New transfer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Transfers' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/transfers');
  });
});
