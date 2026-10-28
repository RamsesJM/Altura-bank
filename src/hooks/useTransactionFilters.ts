import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { TransactionFilters } from '../types/banking';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const URL_KEYS: Record<keyof TransactionFilters, string> = {
  accountId: 'account',
  type: 'type',
  from: 'from',
  to: 'to',
  q: 'q',
};

function readDate(value: string | null): string | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : undefined;
}

function readFilters(params: URLSearchParams): TransactionFilters {
  const type = params.get('type');
  return {
    accountId: params.get('account') || undefined,
    type: type === 'credit' || type === 'debit' ? type : undefined,
    from: readDate(params.get('from')),
    to: readDate(params.get('to')),
    q: params.get('q')?.trim() || undefined,
  };
}

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function useTransactionFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => readFilters(params), [params]);
  const page = readPage(params.get('page'));
  const hasFilters = Object.values(filters).some(Boolean);

  const setFilter = useCallback(
    (key: keyof TransactionFilters, value: string | undefined) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(URL_KEYS[key], value);
        else next.delete(URL_KEYS[key]);
        next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  const setPage = useCallback(
    (nextPage: number, { replace = false } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nextPage > 1) next.set('page', String(nextPage));
          else next.delete('page');
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  const clearFilters = useCallback(() => setParams(new URLSearchParams()), [setParams]);

  return { filters, page, hasFilters, setFilter, setPage, clearFilters };
}
