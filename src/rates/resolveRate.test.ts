import { describe, it, expect, vi } from 'vitest';
import type { RateCache } from '../domain/types';
import { resolveRate, type ResolveRateDeps } from './resolveRate';

function cacheEntry(over: Partial<RateCache> = {}): RateCache {
  return {
    key: 'CNY:JPY:2026-09-12',
    base: 'CNY',
    date: '2026-09-12',
    rate: 23.4,
    effectiveDate: '2026-09-12',
    fetchedAt: 0,
    source: 'frankfurter',
    ...over,
  };
}

function deps(over: Partial<ResolveRateDeps> = {}): Partial<ResolveRateDeps> {
  return {
    getCachedRate: vi.fn(async () => undefined),
    putCachedRate: vi.fn(async () => undefined),
    latestCachedRate: vi.fn(async () => undefined),
    fetchFrankfurter: vi.fn(async () => {
      throw new Error('offline');
    }),
    fetchErApi: vi.fn(async () => {
      throw new Error('offline');
    }),
    today: '2026-09-12',
    ...over,
  };
}

describe('resolveRate', () => {
  it('キャッシュに当たれば通信しない', async () => {
    const d = deps({ getCachedRate: vi.fn(async () => cacheEntry()) });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result).toEqual({
      rate: 23.4,
      effectiveDate: '2026-09-12',
      source: 'cache',
      stale: false,
    });
    expect(d.fetchFrankfurter).not.toHaveBeenCalled();
  });

  it('Frankfurter が成功したら結果をキャッシュに保存する', async () => {
    const d = deps({
      fetchFrankfurter: vi.fn(async () => ({ rate: 23.465, effectiveDate: '2026-09-12' })),
    });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result).toEqual({
      rate: 23.465,
      effectiveDate: '2026-09-12',
      source: 'api',
      stale: false,
    });
    expect(d.putCachedRate).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'CNY:JPY:2026-09-12',
        base: 'CNY',
        date: '2026-09-12',
        rate: 23.465,
        source: 'frankfurter',
      }),
    );
  });

  it('土日で直近営業日のレートが返ったら stale にする', async () => {
    const d = deps({
      fetchFrankfurter: vi.fn(async () => ({ rate: 23.4, effectiveDate: '2026-09-11' })),
    });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result?.stale).toBe(true);
    expect(result?.effectiveDate).toBe('2026-09-11');
  });

  it('Frankfurter が落ちていて当日なら er-api を試す', async () => {
    const d = deps({ fetchErApi: vi.fn(async () => ({ rate: 23.9, effectiveDate: '2026-09-12' })) });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result?.rate).toBe(23.9);
    expect(result?.source).toBe('api');
    expect(d.putCachedRate).toHaveBeenCalledWith(expect.objectContaining({ source: 'er-api' }));
  });

  it('過去日では er-api を呼ばない(当日レートしか返さないため)', async () => {
    const d = deps({
      latestCachedRate: vi.fn(async () => cacheEntry({ date: '2026-09-10', effectiveDate: '2026-09-10' })),
    });
    const result = await resolveRate('CNY', '2026-09-08', d);

    expect(d.fetchErApi).not.toHaveBeenCalled();
    expect(result?.source).toBe('cache');
    expect(result?.effectiveDate).toBe('2026-09-10');
  });

  it('通信が全滅したら直近キャッシュを stale 付きで返す', async () => {
    const d = deps({
      latestCachedRate: vi.fn(async () =>
        cacheEntry({ date: '2026-09-10', effectiveDate: '2026-09-10', rate: 23.0 }),
      ),
    });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result).toEqual({
      rate: 23.0,
      effectiveDate: '2026-09-10',
      source: 'cache',
      stale: true,
    });
  });

  it('キャッシュも空なら null を返す(UI で手動入力を求める)', async () => {
    expect(await resolveRate('CNY', '2026-09-12', deps())).toBeNull();
  });
});
