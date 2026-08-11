import { describe, it, expect, vi } from 'vitest';
import { fetchFrankfurterRate } from './frankfurter';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchFrankfurterRate', () => {
  it('日付と通貨ペアを指定してレートを取り出す', async () => {
    // amount=1000000 で問い合わせるので応答も 100 万倍で返る
    const fetchImpl = vi.fn(async () => jsonResponse({ rates: { JPY: 23465000 }, date: '2026-09-11' }));
    const r = await fetchFrankfurterRate('CNY', 'JPY', '2026-09-12', fetchImpl as unknown as typeof fetch);

    expect(r).toEqual({ rate: 23.465, effectiveDate: '2026-09-11' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/2026-09-12?base=CNY&symbols=JPY&amount=1000000',
    );
  });

  it('1 を大きく下回るレートでも桁を落とさない', async () => {
    // 1 円 = 0.0056306 ドル。amount=1 だと応答が 0.01 に丸められてしまう
    const fetchImpl = vi.fn(async () => jsonResponse({ rates: { USD: 5630.6 }, date: '2026-09-12' }));
    const r = await fetchFrankfurterRate('JPY', 'USD', '2026-09-12', fetchImpl as unknown as typeof fetch);

    expect(r.rate).toBeCloseTo(0.0056306, 9);
  });

  it('HTTP エラーは例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 404));
    await expect(
      fetchFrankfurterRate('CNY', 'JPY', '2026-09-12', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow();
  });

  it('相手通貨が含まれない応答は例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ rates: {}, date: '2026-09-12' }));
    await expect(
      fetchFrankfurterRate('CNY', 'JPY', '2026-09-12', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow();
  });

  it('レートが 0 以下なら例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ rates: { JPY: 0 }, date: '2026-09-12' }));
    await expect(
      fetchFrankfurterRate('CNY', 'JPY', '2026-09-12', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow();
  });
});
