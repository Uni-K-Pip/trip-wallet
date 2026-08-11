import { describe, it, expect, vi } from 'vitest';
import { fetchErApiRate } from './erApi';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchErApiRate', () => {
  it('最新レートと更新日を取り出す', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        result: 'success',
        time_last_update_unix: Date.UTC(2026, 8, 12, 0, 0, 0) / 1000,
        rates: { JPY: 23.5 },
      }),
    );
    const r = await fetchErApiRate('CNY', 'JPY', '2026-09-12', fetchImpl as unknown as typeof fetch);

    expect(r.rate).toBe(23.5);
    expect(r.effectiveDate).toMatch(/^2026-09-1[12]$/);
    expect(fetchImpl).toHaveBeenCalledWith('https://open.er-api.com/v6/latest/CNY');
  });

  it('更新時刻が無ければ渡された日付を使う', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ result: 'success', rates: { JPY: 23.5 } }));
    const r = await fetchErApiRate('CNY', 'JPY', '2026-09-12', fetchImpl as unknown as typeof fetch);

    expect(r.effectiveDate).toBe('2026-09-12');
  });

  it('1 を大きく下回るレートは逆方向を引いて精度を上げる', async () => {
    // 直接引くと 1 円 = 0.0056 ドル(4 桁で丸め)。逆方向は 1 ドル = 177.6 円と細かい
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('/JPY')
        ? jsonResponse({ result: 'success', rates: { USD: 0.0056 } })
        : jsonResponse({ result: 'success', rates: { JPY: 177.6 } }),
    );
    const r = await fetchErApiRate('JPY', 'USD', '2026-09-12', fetchImpl as unknown as typeof fetch);

    expect(r.rate).toBeCloseTo(1 / 177.6, 9);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('逆方向の取得に失敗したら直接のレートを使う', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/JPY')) return jsonResponse({ result: 'success', rates: { USD: 0.0056 } });
      throw new Error('offline');
    });
    const r = await fetchErApiRate('JPY', 'USD', '2026-09-12', fetchImpl as unknown as typeof fetch);

    expect(r.rate).toBe(0.0056);
  });

  it('result が error なら例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ result: 'error' }));
    await expect(
      fetchErApiRate('CNY', 'JPY', '2026-09-12', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow();
  });

  it('HTTP エラーは例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 500));
    await expect(
      fetchErApiRate('CNY', 'JPY', '2026-09-12', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow();
  });
});
