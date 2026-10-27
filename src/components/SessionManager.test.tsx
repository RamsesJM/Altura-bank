import { act, fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../mocks/server';
import { getCurrentUser } from '../services/authService';
import { renderApp } from '../test/renderApp';
import { seedSession } from '../test/session';

const EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

async function advance(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 1_000) {
    await act(async () => {
      vi.advanceTimersByTime(Math.min(1_000, ms - elapsed));
    });
  }
}

async function renderDashboard() {
  await seedSession();
  const utils = renderApp('/', { advanceTimers: vi.advanceTimersByTime });
  await screen.findByRole('heading', { name: 'Welcome back, Ramses' });
  return utils;
}

const warningDialog = () =>
  screen.queryByRole('dialog', { name: 'Your session is about to expire' });

describe('SessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('shows the warning with a countdown after 4 minutes of inactivity', async () => {
    await renderDashboard();

    await advance(240_000);

    const dialog = warningDialog();
    expect(dialog).toBeInTheDocument();
    expect(within(dialog!).getByText(/[01]:\d{2}/)).toBeInTheDocument();
  });

  it('signs out after 5 minutes and shows the expired banner', async () => {
    await renderDashboard();

    await advance(300_000);

    expect(await screen.findByText(EXPIRED_MESSAGE)).toBeInTheDocument();
  });

  it('keeps the session open when the user is active', async () => {
    await renderDashboard();

    await advance(210_000);
    fireEvent.keyDown(window);
    await advance(230_000);

    expect(warningDialog()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome back, Ramses' })).toBeInTheDocument();
  });

  it('keeps the warning open when the user moves the mouse', async () => {
    await renderDashboard();

    await advance(240_000);
    fireEvent.mouseMove(window);
    await advance(1_000);

    expect(warningDialog()).toBeInTheDocument();
  });

  it('extends the server session when the user chooses to stay signed in', async () => {
    const { user } = await renderDashboard();

    await advance(240_000);
    await user.click(within(warningDialog()!).getByRole('button', { name: 'Stay signed in' }));
    await advance(230_000);

    expect(warningDialog()).not.toBeInTheDocument();
    await expect(getCurrentUser()).resolves.toBeDefined();
  });

  it('keeps an active user signed in past the server session lifetime', async () => {
    await renderDashboard();

    for (let elapsed = 0; elapsed < 360_000; elapsed += 50_000) {
      await advance(50_000);
      fireEvent.keyDown(window);
    }
    await advance(1_000);

    expect(warningDialog()).not.toBeInTheDocument();
    await expect(getCurrentUser()).resolves.toBeDefined();
  });

  it('warns before the server session ends when the last refresh is old', async () => {
    const { user } = await renderDashboard();

    await advance(59_000);
    fireEvent.keyDown(window);
    await advance(211_000);

    expect(warningDialog()).toBeInTheDocument();

    await user.click(within(warningDialog()!).getByRole('button', { name: 'Stay signed in' }));
    await advance(1_000);

    expect(screen.queryByText(EXPIRED_MESSAGE)).not.toBeInTheDocument();
    await expect(getCurrentUser()).resolves.toBeDefined();
  });

  it('signs out without the expired banner when choosing sign out', async () => {
    const { user } = await renderDashboard();

    await advance(240_000);
    await user.click(within(warningDialog()!).getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in to Altura Bank' })).toBeInTheDocument();
    expect(screen.queryByText(EXPIRED_MESSAGE)).not.toBeInTheDocument();
  });

  it('treats a rejected refresh as an expired session', async () => {
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json(
          { code: 'SESSION_EXPIRED', message: 'Your session has expired.' },
          { status: 401 },
        ),
      ),
    );
    const { user } = await renderDashboard();

    await advance(240_000);
    await user.click(within(warningDialog()!).getByRole('button', { name: 'Stay signed in' }));

    expect(await screen.findByText(EXPIRED_MESSAGE)).toBeInTheDocument();
  });
});
