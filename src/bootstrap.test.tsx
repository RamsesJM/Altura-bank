import type { Root } from 'react-dom/client';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startApp } from './bootstrap';

let container: HTMLElement;
let root: Root | undefined;

async function start(options: Parameters<typeof startApp>[1]) {
  container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    root = await startApp(container, options);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
});

describe('startApp', () => {
  it('renders the app when the mock API starts', async () => {
    await start({ startMocking: () => Promise.resolve() });

    expect(
      await screen.findByRole('heading', { name: 'Sign in to Altura Bank' }),
    ).toBeInTheDocument();
  });

  it('shows a notice when the mock API cannot start', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('blocked');

    await start({ startMocking: () => Promise.reject(error) });

    expect(
      await screen.findByRole('heading', { level: 1, name: "This demo couldn't start" }),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith('[Altura Bank] The mock API could not start.', error);
    consoleError.mockRestore();
  });

  it('retries by reloading the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reload = vi.fn();
    const user = userEvent.setup();

    await start({ startMocking: () => Promise.reject(new Error('blocked')), reload });
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(reload).toHaveBeenCalledOnce();
    vi.mocked(console.error).mockRestore();
  });
});
