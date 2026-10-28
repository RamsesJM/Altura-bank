import { useEffect, useId, useRef, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Account, TransactionFilters as Filters } from '../../types/banking';

const SEARCH_DELAY_MS = 300;

const ACCOUNT_LABELS: Record<Account['type'], string> = {
  savings: 'Savings',
  checking: 'Checking',
};

interface TransactionFiltersProps {
  accounts: Account[];
  filters: Filters;
  hasFilters: boolean;
  rangeErrorId?: string;
  onChange: (key: keyof Filters, value: string | undefined) => void;
  onClear: () => void;
  onSearchDraftChange: (value: string) => void;
  focusSearchOnMount?: boolean;
}

const fieldClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 sm:text-sm focus-visible:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 aria-invalid:border-red-500';

const labelClass = 'mb-1 block text-xs font-medium text-slate-600';

export function TransactionFilters({
  accounts,
  filters,
  hasFilters,
  rangeErrorId,
  onChange,
  onClear,
  onSearchDraftChange,
  focusSearchOnMount = false,
}: TransactionFiltersProps) {
  const id = useId();
  const [search, setSearch] = useState(filters.q ?? '');
  const [syncedQuery, setSyncedQuery] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DELAY_MS);
  const searchRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ query: filters.q, onChange, onSearchDraftChange });

  if (filters.q !== syncedQuery) {
    setSyncedQuery(filters.q);
    if ((filters.q ?? '') !== search.trim()) setSearch(filters.q ?? '');
  }

  useEffect(() => {
    latest.current = { query: filters.q, onChange, onSearchDraftChange };
  });

  useEffect(() => {
    latest.current.onSearchDraftChange(search);
  }, [search]);

  useEffect(() => {
    const next = debouncedSearch.trim() || undefined;
    if (next !== latest.current.query) latest.current.onChange('q', next);
  }, [debouncedSearch]);

  useEffect(() => {
    if (focusSearchOnMount) searchRef.current?.focus();
  }, [focusSearchOnMount]);

  const invalidRange = Boolean(rangeErrorId);

  return (
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)_auto] lg:items-end">
      <div>
        <label htmlFor={`${id}-account`} className={labelClass}>
          Account
        </label>
        <select
          id={`${id}-account`}
          value={filters.accountId ?? ''}
          onChange={(event) => onChange('accountId', event.target.value || undefined)}
          className={fieldClass}
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {`${ACCOUNT_LABELS[account.type]} ${account.currency} ····${account.number.slice(-4)}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-type`} className={labelClass}>
          Type
        </label>
        <select
          id={`${id}-type`}
          value={filters.type ?? ''}
          onChange={(event) => onChange('type', event.target.value || undefined)}
          className={fieldClass}
        >
          <option value="">All types</option>
          <option value="credit">Credits</option>
          <option value="debit">Debits</option>
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-from`} className={labelClass}>
          From
        </label>
        <input
          id={`${id}-from`}
          type="date"
          value={filters.from ?? ''}
          max={filters.to}
          aria-invalid={invalidRange || undefined}
          aria-describedby={rangeErrorId}
          onChange={(event) => onChange('from', event.target.value || undefined)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${id}-to`} className={labelClass}>
          To
        </label>
        <input
          id={`${id}-to`}
          type="date"
          value={filters.to ?? ''}
          min={filters.from}
          aria-invalid={invalidRange || undefined}
          aria-describedby={rangeErrorId}
          onChange={(event) => onChange('to', event.target.value || undefined)}
          className={fieldClass}
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor={`${id}-search`} className={labelClass}>
          Search transactions
        </label>
        <input
          ref={searchRef}
          id={`${id}-search`}
          type="search"
          value={search}
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
          className={fieldClass}
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-lg px-4 text-sm font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
