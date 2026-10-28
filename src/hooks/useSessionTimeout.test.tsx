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

function lockFor(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

function returnToPage(event: 'visibilitychange' | 'pageshow' = 'visibilitychange') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  act(() => {
    if (event === 'pageshow') window.dispatchEvent(new Event('pageshow'));
    else document.dispatchEvent(new Event('visibilitychange'));
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
    fireEvent.pointerMove(window);

    expect(result.current.isWarning).toBe(true);
    expect(onActivity).not.toHaveBeenCalled();
  });

  it('throttles activity to once per second', () => {
    const { onActivity } = setup();

    fireEvent.keyDown(window);
    fireEvent.pointerDown(window);
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

  it('restarts the timer on a pointer tap', () => {
    const { result, onExpire } = setup();

    advance(210_000);
    fireEvent.pointerDown(window);
    advance(TIMEOUT - WARNING - 1_000);

    expect(result.current.isWarning).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('restarts the timer when an inner element scrolls', () => {
    const box = document.createElement('div');
    document.body.append(box);
    const { result } = setup();

    advance(210_000);
    fireEvent.scroll(box);
    advance(TIMEOUT - WARNING - 1_000);

    expect(result.current.isWarning).toBe(false);
    box.remove();
  });

  describe('when the page comes back from the background', () => {
    it('expires as soon as the page becomes visible after the timeout', () => {
      const { onExpire, onActivity } = setup();

      lockFor(20 * 60_000);
      returnToPage();

      expect(onExpire).toHaveBeenCalledOnce();
      expect(onActivity).not.toHaveBeenCalled();
    });

    it('expires on pageshow after the timeout', () => {
      const { onExpire } = setup();

      lockFor(TIMEOUT);
      returnToPage('pageshow');

      expect(onExpire).toHaveBeenCalledOnce();
    });

    it('expires once when both return events fire', () => {
      const { onExpire } = setup();

      lockFor(TIMEOUT);
      returnToPage();
      returnToPage('pageshow');

      expect(onExpire).toHaveBeenCalledOnce();
    });

    it('a tap after the timeout signs out instead of extending', () => {
      const { onExpire, onActivity } = setup();

      lockFor(TIMEOUT + 1_000);
      fireEvent.pointerDown(window);

      expect(onExpire).toHaveBeenCalledOnce();
      expect(onActivity).not.toHaveBeenCalled();
    });

    it('updates the countdown when the page becomes visible', () => {
      const { result, onExpire } = setup();

      lockFor(2 * 60_000);
      returnToPage();

      expect(onExpire).not.toHaveBeenCalled();
      expect(result.current.remainingMs).toBe(180_000);
    });

    it('expires on return when the server expiry has passed', () => {
      const { onExpire } = setup({ expiresAt: Date.now() + 120_000 });

      lockFor(121_000);
      returnToPage();

      expect(onExpire).toHaveBeenCalledOnce();
    });

    it('ignores return events while disabled', () => {
      const { onExpire } = setup({ enabled: false });

      lockFor(TIMEOUT);
      returnToPage();

      expect(onExpire).not.toHaveBeenCalled();
    });
  });
});
