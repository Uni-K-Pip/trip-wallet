import { currencyDecimals } from '../domain/currency';
import { todayLocal } from '../domain/date';
import type { Trip } from '../domain/types';
import { db, newId } from './db';

export type TripInput = {
  name: string;
  currency: string;
  startDate?: string;
  endDate?: string | null;
  personalBudgetJpy?: number | null;
  sharedBudgetJpy?: number | null;
  memberCount?: number;
};

export async function createTrip(input: TripInput): Promise<Trip> {
  const trip: Trip = {
    id: newId(),
    name: input.name,
    currency: input.currency,
    currencyDecimals: currencyDecimals(input.currency),
    startDate: input.startDate ?? todayLocal(),
    endDate: input.endDate ?? null,
    personalBudgetJpy: input.personalBudgetJpy ?? null,
    sharedBudgetJpy: input.sharedBudgetJpy ?? null,
    memberCount: Math.max(1, input.memberCount ?? 1),
    createdAt: Date.now(),
  };
  await db.trips.add(trip);
  return trip;
}

export async function updateTrip(id: string, patch: Partial<TripInput>): Promise<void> {
  const changes: Partial<Trip> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.startDate !== undefined) changes.startDate = patch.startDate;
  if (patch.endDate !== undefined) changes.endDate = patch.endDate;
  if (patch.personalBudgetJpy !== undefined) changes.personalBudgetJpy = patch.personalBudgetJpy;
  if (patch.sharedBudgetJpy !== undefined) changes.sharedBudgetJpy = patch.sharedBudgetJpy;
  if (patch.memberCount !== undefined) changes.memberCount = Math.max(1, patch.memberCount);
  if (patch.currency !== undefined) {
    changes.currency = patch.currency;
    // 小数桁数は通貨から必ず導く。手で食い違わせない。
    changes.currencyDecimals = currencyDecimals(patch.currency);
  }
  await db.trips.update(id, changes);
}

export function getTrip(id: string): Promise<Trip | undefined> {
  return db.trips.get(id);
}

export async function listTrips(): Promise<Trip[]> {
  return db.trips.orderBy('createdAt').reverse().toArray();
}

/** 旅行に紐づく支出と写真もまとめて消す。孤児レコードを残さない。 */
export async function deleteTrip(id: string): Promise<void> {
  await db.transaction('rw', db.trips, db.expenses, db.photos, async () => {
    const expenses = await db.expenses.where('tripId').equals(id).toArray();
    const photoIds = expenses.map((e) => e.photoId).filter((p): p is string => p !== null);
    if (photoIds.length > 0) await db.photos.bulkDelete(photoIds);
    await db.expenses.bulkDelete(expenses.map((e) => e.id));
    await db.trips.delete(id);
  });
}
