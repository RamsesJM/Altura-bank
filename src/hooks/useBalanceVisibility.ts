import { useCallback, useState } from 'react';

const STORAGE_KEY = 'altura.hideBalances';

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function savePreference(hidden: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(hidden));
  } catch {
    // Without storage the preference only lasts until the page is reloaded.
  }
}

export function useBalanceVisibility() {
  const [hidden, setHidden] = useState(readPreference);

  const toggle = useCallback(() => {
    setHidden((current) => {
      const next = !current;
      savePreference(next);
      return next;
    });
  }, []);

  return { hidden, toggle };
}
