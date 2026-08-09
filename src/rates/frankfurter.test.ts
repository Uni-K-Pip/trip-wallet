import { describe, it, expect, vi } from 'vitest';
import { fetchFrankfurterRate } from './frankfurter';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchFrankfurterRate', () => {
  it('日付と通貨を指定して JPY レートを取り出す', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ amount: 1, base: 'CNY', date: '2026-09-11', rates: { JPY: 23.465 } }),
    );
    const result = await fetchFrankfurterRate('CNY', '2026-09-12', fetchImpl as never);

    expect(result).toEqual({ rate: 23.465, effectiveDate: '2026-09-11' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/2026-09-12?base=CNY&symbols=JPY',
    );
  });

  it('HTTP エラーは例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 404));
    await expect(fetchFrankfurterRate('CNY', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });

  it('JPY が含まれない応答は例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ date: '2026-09-12', rates: {} }));
    await expect(fetchFrankfurterRate('TWD', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });

  it('レートが 0 以下なら例外にする', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ date: '2026-09-12', rates: { JPY: 0 } }),
    );
    await expect(fetchFrankfurterRate('CNY', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });
});
