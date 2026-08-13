import Dexie from 'dexie';
import { describe, it, expect, afterEach } from 'vitest';
import { TripWalletDb } from './db';

const DB_NAME = 'trip-wallet';

/** 移行前の形のデータを書き込むためだけの、旧スキーマの Dexie。 */
function openLegacy(version: 1 | 2): Dexie {
  const legacy = new Dexie(DB_NAME);
  const v1Stores = {
    trips: 'id, createdAt',
    expenses: 'id, tripId, [tripId+date], date, createdAt',
    photos: 'id',
    rates: 'key, base, [base+date], date',
  };
  legacy.version(1).stores(v1Stores);
  // v2 はインデックスを変えていないので、同じ定義のまま版番号だけ進める
  if (version === 2) legacy.version(2).stores(v1Stores);
  return legacy;
}

afterEach(async () => {
  await Dexie.delete(DB_NAME);
});

describe('DB の移行', () => {
  it('v1 の budgetJpy が個別予算になり、旧キーが消える', async () => {
    const legacy = openLegacy(1);
    await legacy.table('trips').put({
      id: 't1',
      name: '上海 2026-09',
      currency: 'CNY',
      currencyDecimals: 2,
      startDate: '2026-09-12',
      endDate: null,
      budgetJpy: 50000,
      memberCount: 2,
      createdAt: 0,
    });
    legacy.close();

    const db = new TripWalletDb();
    const trip = (await db.trips.get('t1')) as unknown as Record<string, unknown>;
    db.close();

    expect(trip.personalBudgetHome).toBe(50000);
    expect(trip.sharedBudgetHome).toBeNull();
    expect(trip.homeCurrency).toBe('JPY');
    expect(trip.homeCurrencyDecimals).toBe(0);
    expect('budgetJpy' in trip).toBe(false);
  });

  it('v2 の円建て予算が換算先通貨の予算に移り、旧キーが消える', async () => {
    const legacy = openLegacy(2);
    await legacy.table('trips').put({
      id: 't2',
      name: 'NY 2026-09',
      currency: 'USD',
      currencyDecimals: 2,
      startDate: '2026-09-12',
      endDate: null,
      personalBudgetJpy: 50000,
      sharedBudgetJpy: 30000,
      memberCount: 1,
      createdAt: 0,
    });
    legacy.close();

    const db = new TripWalletDb();
    const trip = (await db.trips.get('t2')) as unknown as Record<string, unknown>;
    db.close();

    expect(trip.personalBudgetHome).toBe(50000);
    expect(trip.sharedBudgetHome).toBe(30000);
    expect(trip.homeCurrency).toBe('JPY');
    expect('personalBudgetJpy' in trip).toBe(false);
    expect('sharedBudgetJpy' in trip).toBe(false);
  });

  it('v2 までのレートに quote が付き、新しいインデックスで引ける', async () => {
    const legacy = openLegacy(2);
    await legacy.table('rates').put({
      key: 'CNY:JPY:2026-09-12',
      base: 'CNY',
      date: '2026-09-12',
      rate: 23.465,
      effectiveDate: '2026-09-11',
      fetchedAt: 0,
      source: 'frankfurter',
    });
    legacy.close();

    const db = new TripWalletDb();
    const rows = await db.rates.where('[base+quote]').equals(['CNY', 'JPY']).toArray();
    db.close();

    expect(rows).toHaveLength(1);
    expect(rows[0].quote).toBe('JPY');
    expect(rows[0].rate).toBe(23.465);
  });
});
