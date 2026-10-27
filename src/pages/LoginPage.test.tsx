import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_EMAIL, DEMO_PASSWORD, LOCKOUT_MS } from '../mocks/db';
import { server } from '../mocks/server';
import { renderApp } from '../test/renderApp';

const emailInput = () => screen.getByLabelText('Email');
const passwordInput = () => screen.getByLabelText('Password');
const submitButton = () => screen.getByRole('button', { name: /^(sign in|signing in\.\.\.)$/i });

async function renderLogin(...args: Parameters<typeof renderApp>) {
  const utils = renderApp(...args);
  await screen.findByRole('heading', { name: 'Sign in to Altura Bank' });
  return utils;
}

async function submitWith(user: UserEvent, email: string, password: string) {
  await user.clear(emailInput());
  await user.type(emailInput(), email);
  await user.clear(passwordInput());
  await user.type(passwordInput(), password);
  await user.click(submitButton());
}

describe('LoginPage', () => {
  it('shows field errors and focuses the first invalid field', async () => {
    const { user } = await renderLogin('/login');

    await user.click(submitButton());

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput()).toHaveFocus();
  });

  it('rejects an email without a valid format', async () => {
    const { user } = await renderLogin('/login');

    await submitWith(user, 'demo@', 'anything');

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('fills both fields with the demo account without submitting', async () => {
    const { user } = await renderLogin('/login');

    await user.click(screen.getByRole('button', { name: 'Use demo account' }));

    expect(emailInput()).toHaveValue(DEMO_EMAIL);
    expect(passwordInput()).toHaveValue(DEMO_PASSWORD);
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('toggles password visibility', async () => {
    const { user } = await renderLogin('/login');
    const toggle = screen.getByRole('button', { name: 'Show password' });

    await user.click(toggle);

    expect(passwordInput()).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the remaining attempts after a wrong password', async () => {
    const { user } = await renderLogin('/login');

    await submitWith(user, DEMO_EMAIL, 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Incorrect email or password. 2 attempts remaining.',
    );

    await submitWith(user, DEMO_EMAIL, 'wrong');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Incorrect email or password. 1 attempt remaining.',
      ),
    );
  });

  it('locks the form for 60 seconds after the third failure', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = await renderLogin('/login', { advanceTimers: vi.advanceTimersByTime });

    for (let attempt = 0; attempt < 3; attempt++) {
      await submitWith(user, DEMO_EMAIL, 'wrong');
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    }

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Account temporarily locked.'),
    );
    const countdown = within(screen.getByRole('alert')).getByText(/^[01]:\d{2}$/);
    expect(countdown).toHaveAttribute('aria-hidden', 'true');
    expect(within(screen.getByRole('alert')).getByText(/^\d+ seconds$/)).toHaveClass('sr-only');
    expect(submitButton()).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(LOCKOUT_MS + 1_000);
    });

    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await submitWith(user, DEMO_EMAIL, 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('2 attempts remaining');
  });

  it('shows a connection message when the network fails', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.error()));
    const { user } = await renderLogin('/login');

    await submitWith(user, DEMO_EMAIL, DEMO_PASSWORD);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't connect. Please try again.",
    );
  });

  it('sends a single request when Enter is pressed twice', async () => {
    let requests = 0;
    server.use(
      http.post('/api/auth/login', async () => {
        requests += 1;
        await delay(200);
        return HttpResponse.json(
          {
            code: 'INVALID_CREDENTIALS',
            message: 'Incorrect email or password.',
            attemptsRemaining: 2,
          },
          { status: 401 },
        );
      }),
    );
    const { user } = await renderLogin('/login');

    await user.type(emailInput(), DEMO_EMAIL);
    await user.type(passwordInput(), 'wrong{Enter}{Enter}');

    await screen.findByRole('alert');
    expect(requests).toBe(1);
  });

  it('trims the email before signing in', async () => {
    const { user } = await renderLogin('/login');

    await submitWith(user, '  demo@alturabank.com ', DEMO_PASSWORD);

    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Ramses' }),
    ).toBeInTheDocument();
  });

  it('returns to the originally requested route after signing in', async () => {
    const { user } = renderApp('/transfers');
    await screen.findByRole('heading', { name: 'Sign in to Altura Bank' });

    await submitWith(user, DEMO_EMAIL, DEMO_PASSWORD);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/transfers'));
  });
});
