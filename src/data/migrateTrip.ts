import { currencyDecimals } from '../domain/currency';
import type { Trip } from '../domain/types';

/**
 * 旧バージョンの旅行を今の形に直す。DB の upgrade とバックアップ取り込みの両方から使う。
 * v1: 予算が budgetJpy 1 本 / v2: 個別・共有の 2 本(円固定) / v3: 換算先通貨つき
 */
export function migrateTrip(trip: Record<string, unknown>): Trip {
  const t: Record<string, unknown> = { ...trip };

  // v1 → v2: 1 本だった予算は個別予算として引き継ぐ
  if (!('personalBudgetJpy' in t) && !('personalBudgetHome' in t)) {
    t.personalBudgetJpy = t.budgetJpy ?? null;
    t.sharedBudgetJpy = null;
  }

  // v2 → v3: 予算は円建てだった。JPY は小数 0 桁なので値の変換は要らず、名前だけ移す
  if (!('personalBudgetHome' in t)) {
    t.personalBudgetHome = t.personalBudgetJpy ?? null;
    t.sharedBudgetHome = t.sharedBudgetJpy ?? null;
  }

  t.homeCurrency ??= 'JPY';
  t.homeCurrencyDecimals ??= currencyDecimals(t.homeCurrency as string);

  delete t.budgetJpy;
  delete t.personalBudgetJpy;
  delete t.sharedBudgetJpy;

  return t as unknown as Trip;
}
