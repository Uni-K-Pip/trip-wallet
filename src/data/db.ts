import Dexie, { type EntityTable } from 'dexie';
import type { Expense, Photo, RateCache, Trip } from '../domain/types';
import { migrateTrip } from './migrateTrip';

export class TripWalletDb extends Dexie {
  trips!: EntityTable<Trip, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  rates!: EntityTable<RateCache, 'key'>;

  constructor() {
    super('trip-wallet');
    this.version(1).stores({
      trips: 'id, createdAt',
      expenses: 'id, tripId, [tripId+date], date, createdAt',
      photos: 'id',
      rates: 'key, base, [base+date], date',
    });

    // 予算フィールドはインデックス対象ではないので stores は変えず、
    // 旧 budgetJpy を個別予算へ移すだけの upgrade を足す。
    this.version(2).upgrade((tx) =>
      tx
        .table('trips')
        .toCollection()
        .modify((trip: Record<string, unknown>) => {
          Object.assign(trip, migrateTrip(trip));
          delete trip.budgetJpy;
        }),
    );
  }
}

export const db = new TripWalletDb();

/** jsdom や古い WebView では crypto.randomUUID が無いことがある。 */
export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
