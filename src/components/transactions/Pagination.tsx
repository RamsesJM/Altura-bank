interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

type PageItem = number | 'gap-start' | 'gap-end';

function pageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const items: PageItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push('gap-start');
  for (let current = start; current <= end; current++) items.push(current);
  if (end < totalPages - 1) items.push('gap-end');
  items.push(totalPages);

  return items;
}

const buttonClass =
  'min-h-11 min-w-11 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40';

export function Pagination({ page, totalPages, total, pageSize, onChange }: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-600">{`Showing ${start}–${end} of ${total} transactions`}</p>
      <nav aria-label="Pagination">
        <ul className="flex flex-wrap items-center gap-1">
          <li>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onChange(page - 1)}
              className={`${buttonClass} text-slate-700 hover:bg-slate-100`}
            >
              Previous
            </button>
          </li>
          {pageItems(page, totalPages).map((item) =>
            typeof item === 'number' ? (
              <li key={item}>
                <button
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => onChange(item)}
                  className={`${buttonClass} ${
                    item === page ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item}
                </button>
              </li>
            ) : (
              <li key={item} aria-hidden="true" className="px-2 text-slate-400">
                …
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onChange(page + 1)}
              className={`${buttonClass} text-slate-700 hover:bg-slate-100`}
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
