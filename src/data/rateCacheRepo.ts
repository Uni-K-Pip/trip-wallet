import type { RateCache } from '../domain/types';
import { db } from './db';

export function rateKey(base: string, date: string): string {
  return `${base}:JPY:${date}`;
}

export function getCachedRate(base: string, date: string): Promise<RateCache | undefined> {
  return db.rates.get(rateKey(base, date));
}

export async function putCachedRate(entry: RateCache): Promise<void> {
  await db.rates.put(entry);
}

/** 同じ通貨で最も新しい日付のキャッシュ。オフライン時のフォールバックに使う。 */
export async function latestCachedRate(base: string): Promise<RateCache | undefined> {
  const rows = await db.rates.where('base').equals(base).toArray();
  if (rows.length === 0) return undefined;
  return rows.sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function countCachedRates(): Promise<number> {
  return db.rates.count();
}
