import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBlob } from './download';

const { createObjectURL, revokeObjectURL } = URL;

describe('saveBlob', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:altura/export');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.restoreAllMocks();
  });

  it('downloads the blob with the given file name and releases its URL', () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const blob = new Blob(['Date'], { type: 'text/csv' });

    saveBlob(blob, 'altura-transactions-2026-10-27.csv');
    const clicked = click.mock.contexts[0] as HTMLAnchorElement | undefined;

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked?.download).toBe('altura-transactions-2026-10-27.csv');
    expect(clicked?.href).toBe('blob:altura/export');
    expect(clicked?.isConnected).toBe(false);

    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:altura/export');
  });
});
