import { db } from './db';
import type { RateCache } from '../domain/types';

export function rateKey(base: string, quote: string, date: string): string {
  return `${base}:${quote}:${date}`;
}

export async function getCachedRate(
  base: string,
  quote: string,
  date: string,
): Promise<RateCache | undefined> {
  return db.rates.get(rateKey(base, quote, date));
}

export async function putCachedRate(entry: RateCache): Promise<void> {
  await db.rates.put(entry);
}

/** 通信できないときの最後の手段。通貨ペアをまたいで拾わないよう [base+quote] で絞る。 */
export async function latestCachedRate(base: string, quote: string): Promise<RateCache | undefined> {
  const rows = await db.rates.where('[base+quote]').equals([base, quote]).toArray();
  if (rows.length === 0) return undefined;
  return rows.sort((a, b) => b.date.localeCompare(a.date))[0];
}

export async function countCachedRates(): Promise<number> {
  return db.rates.count();
}
