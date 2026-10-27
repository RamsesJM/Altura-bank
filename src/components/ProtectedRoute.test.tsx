import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readSession, writeSession } from '../services/sessionStore';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

const signInHeading = () => screen.findByRole('heading', { name: /sign in/i });

describe('protected routes', () => {
  it('redirects to /login when there is no session', async () => {
    renderApp('/');

    expect(await signInHeading()).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('shows a loader and then the dashboard when the stored session is valid', async () => {
    await seedSession();
    renderApp('/');

    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Ramses' }),
    ).toBeInTheDocument();
  });

  it('shows the login without the expired banner when the stored token is stale', async () => {
    writeSession({ token: 'stale', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    renderApp('/');

    expect(await signInHeading()).toBeInTheDocument();
    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it('returns to the login page after signing out', async () => {
    await seedSession();
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await signInHeading()).toBeInTheDocument();
    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it('redirects authenticated users away from /login', async () => {
    await seedSession();
    renderApp('/login');

    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Ramses' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
});
