import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBalanceVisibility } from './useBalanceVisibility';

describe('useBalanceVisibility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows balances by default', () => {
    const { result } = renderHook(() => useBalanceVisibility());
    expect(result.current.hidden).toBe(false);
  });

  it('toggles and saves the preference', () => {
    const { result } = renderHook(() => useBalanceVisibility());

    act(() => result.current.toggle());

    expect(result.current.hidden).toBe(true);
    expect(localStorage.getItem('altura.hideBalances')).toBe('true');
  });

  it('reads a saved preference', () => {
    localStorage.setItem('altura.hideBalances', 'true');
    const { result } = renderHook(() => useBalanceVisibility());
    expect(result.current.hidden).toBe(true);
  });

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });

    const { result } = renderHook(() => useBalanceVisibility());
    expect(result.current.hidden).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.hidden).toBe(true);
  });
});
