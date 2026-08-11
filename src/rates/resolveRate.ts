import { getCachedRate, latestCachedRate, putCachedRate, rateKey } from '../data/rateCacheRepo';
import { todayLocal } from '../domain/date';
import type { RateCache, RateSource } from '../domain/types';
import { fetchErApiRate } from './erApi';
import { fetchFrankfurterRate, type FetchedRate } from './frankfurter';

export type ResolvedRate = {
  rate: number;
  /** そのレートが実際に成立した日付 */
  effectiveDate: string;
  source: RateSource;
  /** 要求した日付と effectiveDate がずれている。UI で日付を明示する */
  stale: boolean;
};

export type ResolveRateDeps = {
  getCachedRate: (base: string, quote: string, date: string) => Promise<RateCache | undefined>;
  putCachedRate: (entry: RateCache) => Promise<void>;
  latestCachedRate: (base: string, quote: string) => Promise<RateCache | undefined>;
  fetchFrankfurter: (base: string, quote: string, date: string) => Promise<FetchedRate>;
  fetchErApi: (base: string, quote: string, fallbackDate: string) => Promise<FetchedRate>;
  today: string;
};

function defaultDeps(): ResolveRateDeps {
  return {
    getCachedRate,
    putCachedRate,
    latestCachedRate,
    fetchFrankfurter: (base, quote, date) => fetchFrankfurterRate(base, quote, date),
    fetchErApi: (base, quote, fallbackDate) => fetchErApiRate(base, quote, fallbackDate),
    today: todayLocal(),
  };
}

/**
 * キャッシュ → Frankfurter →(当日のみ)er-api → 直近キャッシュ の順に解決する。
 * すべて外したら null。呼び出し側はレートの手動入力を求めること。
 */
export async function resolveRate(
  base: string,
  quote: string,
  date: string,
  overrides: Partial<ResolveRateDeps> = {},
): Promise<ResolvedRate | null> {
  // 同じ通貨なら換算しない。通信もキャッシュもせず 1 を返す。
  if (base === quote) {
    return { rate: 1, effectiveDate: date, source: 'same', stale: false };
  }

  const deps = { ...defaultDeps(), ...overrides };

  const cached = await deps.getCachedRate(base, quote, date);
  if (cached) {
    return {
      rate: cached.rate,
      effectiveDate: cached.effectiveDate,
      source: 'cache',
      stale: cached.effectiveDate !== date,
    };
  }

  const save = async (fetched: FetchedRate, source: RateCache['source']) => {
    await deps.putCachedRate({
      key: rateKey(base, quote, date),
      base,
      quote,
      date,
      rate: fetched.rate,
      effectiveDate: fetched.effectiveDate,
      fetchedAt: Date.now(),
      source,
    });
    return {
      rate: fetched.rate,
      effectiveDate: fetched.effectiveDate,
      source: 'api' as const,
      stale: fetched.effectiveDate !== date,
    };
  };

  try {
    return await save(await deps.fetchFrankfurter(base, quote, date), 'frankfurter');
  } catch {
    // 次のフォールバックへ進む
  }

  // er-api は当日レートしか返さない。当日以外(過去日・未来日とも)に使うと嘘の値になる。
  if (date === deps.today) {
    try {
      return await save(await deps.fetchErApi(base, quote, date), 'er-api');
    } catch {
      // 次のフォールバックへ進む
    }
  }

  const latest = await deps.latestCachedRate(base, quote);
  if (latest) {
    return {
      rate: latest.rate,
      effectiveDate: latest.effectiveDate,
      source: 'cache',
      stale: true,
    };
  }

  return null;
}

/** 起動時に当日レートを温めておく。現地で電波が悪くても入力を止めないため。 */
export async function prefetchTodayRate(base: string, quote: string): Promise<void> {
  await resolveRate(base, quote, todayLocal());
}
