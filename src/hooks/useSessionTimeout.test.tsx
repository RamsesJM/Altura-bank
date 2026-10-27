import { act, fireEvent, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionTimeout } from './useSessionTimeout';

const TIMEOUT = 300_000;
const WARNING = 60_000;

function setup(overrides: Partial<Parameters<typeof useSessionTimeout>[0]> = {}) {
  const onExpire = vi.fn();
  const onActivity = vi.fn();
  const hook = renderHook(() =>
    useSessionTimeout({ timeoutMs: TIMEOUT, warningMs: WARNING, onExpire, onActivity, ...overrides }),
  );
  return { ...hook, onExpire, onActivity };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('enters the warning state when the remaining time reaches the warning window', () => {
    const { result } = setup();

    advance(TIMEOUT - WARNING - 1_000);
    expect(result.current.isWarning).toBe(false);

    advance(1_000);
    expect(result.current.isWarning).toBe(true);
    expect(result.current.remainingMs).toBe(WARNING);
  });

  it('calls onExpire once when the timeout is reached', () => {
    const { onExpire } = setup();

    advance(TIMEOUT);
    advance(5_000);

    expect(onExpire).toHaveBeenCalledOnce();
  });

  it('restarts the timer on user activity', () => {
    const { result, onExpire } = setup();

    advance(210_000);
    fireEvent.keyDown(window);
    advance(TIMEOUT - WARNING - 1_000);

    expect(result.current.isWarning).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('ignores activity while the warning is shown', () => {
    const { result, onActivity } = setup();

    advance(TIMEOUT - WARNING);
    fireEvent.mouseMove(window);

    expect(result.current.isWarning).toBe(true);
    expect(onActivity).not.toHaveBeenCalled();
  });

  it('throttles activity to once per second', () => {
    const { onActivity } = setup();

    fireEvent.keyDown(window);
    fireEvent.click(window);
    fireEvent.scroll(window);
    expect(onActivity).toHaveBeenCalledTimes(1);

    advance(1_000);
    fireEvent.keyDown(window);
    expect(onActivity).toHaveBeenCalledTimes(2);
  });

  it('reset clears the warning and restores the full timeout', () => {
    const { result } = setup();

    advance(250_000);
    act(() => result.current.reset());

    expect(result.current.isWarning).toBe(false);
    expect(result.current.remainingMs).toBe(TIMEOUT);
  });

  it('never runs past the server session expiry', () => {
    const { result } = setup({ expiresAt: Date.now() + 120_000 });

    fireEvent.keyDown(window);

    expect(result.current.remainingMs).toBe(120_000);
  });

  it('does nothing while disabled', () => {
    const { onExpire } = setup({ enabled: false });

    advance(TIMEOUT * 2);

    expect(onExpire).not.toHaveBeenCalled();
  });
});
