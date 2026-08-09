import { describe, it, expect, vi } from 'vitest';
import { fetchErApiRate } from './erApi';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchErApiRate', () => {
  it('最新レートと更新日を取り出す', async () => {
    // 2026-09-12 00:00:00 UTC。ローカルへ変換した日付を effectiveDate にする
    const unix = Math.floor(Date.UTC(2026, 8, 12, 0, 0, 0) / 1000);
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ result: 'success', time_last_update_unix: unix, rates: { JPY: 23.5 } }),
    );
    const result = await fetchErApiRate('CNY', '2026-09-12', fetchImpl as never);

    expect(result.rate).toBe(23.5);
    expect(result.effectiveDate).toMatch(/^2026-09-1[12]$/);
    expect(fetchImpl).toHaveBeenCalledWith('https://open.er-api.com/v6/latest/CNY');
  });

  it('更新時刻が無ければ渡された日付を使う', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ result: 'success', rates: { JPY: 23.5 } }));
    const result = await fetchErApiRate('CNY', '2026-09-12', fetchImpl as never);
    expect(result.effectiveDate).toBe('2026-09-12');
  });

  it('result が error なら例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ result: 'error' }));
    await expect(fetchErApiRate('CNY', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });

  it('HTTP エラーは例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 500));
    await expect(fetchErApiRate('CNY', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });
});
