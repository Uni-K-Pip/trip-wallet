import type { Trip } from '../domain/types';

/**
 * v1 形式(budgetJpy を持つ)の旅行を v2 形式に直す。v2 形式ならそのまま返す。
 *
 * 引数は backup.ts の isTrip を通ったもの、または DB に入っている旅行レコードだけを
 * 想定する。予算以外のフィールドは touch しない。
 * DB の upgrade とバックアップ取り込みの両方から呼ぶので、IndexedDB に依存させない。
 */
export function migrateTripBudget(trip: Record<string, unknown>): Trip {
  const { budgetJpy, ...rest } = trip;
  const migrated = rest as unknown as Trip;
  if ('personalBudgetJpy' in trip) return migrated;

  return {
    ...migrated,
    personalBudgetJpy: typeof budgetJpy === 'number' ? budgetJpy : null,
    sharedBudgetJpy: null,
  };
}
