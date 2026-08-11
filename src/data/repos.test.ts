import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { createTrip, updateTrip, listTrips, getTrip, deleteTrip } from './tripRepo';
import { addExpense, updateExpense, deleteExpense, listExpenses } from './expenseRepo';
import { savePhoto, getPhoto } from './photoRepo';
import {
  rateKey,
  getCachedRate,
  putCachedRate,
  latestCachedRate,
  countCachedRates,
} from './rateCacheRepo';
import type { ExpenseInput } from './expenseRepo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function expenseInput(over: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    tripId: 't1',
    date: '2026-09-12',
    amountMinor: 10000,
    scope: 'personal',
    category: 'food',
    payment: 'cash',
    memo: '',
    rate: 20,
    rateSource: 'api',
    photoId: null,
    ...over,
  };
}

describe('tripRepo', () => {
  it('通貨から小数桁数を自動で決めて保存する', async () => {
    const trip = await createTrip({ name: '上海', currency: 'CNY', homeCurrency: 'JPY' });
    expect(trip.currencyDecimals).toBe(2);
    expect((await getTrip(trip.id))?.name).toBe('上海');

    const seoul = await createTrip({ name: 'ソウル', currency: 'KRW', homeCurrency: 'JPY' });
    expect(seoul.currencyDecimals).toBe(0);
  });

  it('既定値は 1 人・予算なし・終了日なし', async () => {
    const trip = await createTrip({ name: '上海', currency: 'CNY', homeCurrency: 'JPY' });
    expect(trip.memberCount).toBe(1);
    expect(trip.personalBudgetHome).toBeNull();
    expect(trip.sharedBudgetHome).toBeNull();
    expect(trip.endDate).toBeNull();
  });

  it('新しい旅行から順に並ぶ', async () => {
    const a = await createTrip({ name: '古い', currency: 'CNY', homeCurrency: 'JPY' });
    await new Promise((r) => setTimeout(r, 2));
    const b = await createTrip({ name: '新しい', currency: 'CNY', homeCurrency: 'JPY' });
    expect((await listTrips()).map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it('通貨を変えると小数桁数も追随する', async () => {
    const trip = await createTrip({ name: '旅', currency: 'CNY', homeCurrency: 'JPY' });
    await updateTrip(trip.id, { currency: 'KRW' });
    expect((await getTrip(trip.id))?.currencyDecimals).toBe(0);
  });

  it('人数は 1 未満にできない', async () => {
    const trip = await createTrip({
      name: '旅',
      currency: 'CNY',
      homeCurrency: 'JPY',
      memberCount: 0,
    });
    expect(trip.memberCount).toBe(1);
    await updateTrip(trip.id, { memberCount: -3 });
    expect((await getTrip(trip.id))?.memberCount).toBe(1);
  });

  it('旅行を消すと支出と写真も消える', async () => {
    const trip = await createTrip({ name: '旅', currency: 'CNY', homeCurrency: 'JPY' });
    const photoId = await savePhoto(new Blob(['x'], { type: 'image/jpeg' }));
    await addExpense(expenseInput({ tripId: trip.id, photoId }));
    await deleteTrip(trip.id);

    expect(await getTrip(trip.id)).toBeUndefined();
    expect(await listExpenses(trip.id)).toEqual([]);
    expect(await getPhoto(photoId)).toBeUndefined();
  });
});

describe('expenseRepo', () => {
  it('id と作成時刻を採番して保存する', async () => {
    const e = await addExpense(expenseInput());
    expect(e.id).toBeTruthy();
    expect(e.createdAt).toBeGreaterThan(0);
    expect(e.updatedAt).toBe(e.createdAt);
  });

  it('旅行ごとに絞り込む', async () => {
    await addExpense(expenseInput({ tripId: 't1' }));
    await addExpense(expenseInput({ tripId: 't2' }));
    expect(await listExpenses('t1')).toHaveLength(1);
  });

  it('日付の新しい順、同日なら登録の新しい順に並ぶ', async () => {
    const old = await addExpense(expenseInput({ date: '2026-09-12' }));
    await new Promise((r) => setTimeout(r, 2));
    const same = await addExpense(expenseInput({ date: '2026-09-12' }));
    const later = await addExpense(expenseInput({ date: '2026-09-13' }));
    expect((await listExpenses('t1')).map((e) => e.id)).toEqual([later.id, same.id, old.id]);
  });

  it('更新すると updatedAt が進む', async () => {
    const e = await addExpense(expenseInput());
    await new Promise((r) => setTimeout(r, 2));
    await updateExpense(e.id, { memo: '小籠包' });
    const after = (await listExpenses('t1'))[0];
    expect(after.memo).toBe('小籠包');
    expect(after.updatedAt).toBeGreaterThan(e.updatedAt);
  });

  it('支出を消すと紐づく写真も消える', async () => {
    const photoId = await savePhoto(new Blob(['x'], { type: 'image/jpeg' }));
    const e = await addExpense(expenseInput({ photoId }));
    await deleteExpense(e.id);
    expect(await listExpenses('t1')).toEqual([]);
    expect(await getPhoto(photoId)).toBeUndefined();
  });
});

describe('rateCacheRepo', () => {
  it('キーは通貨と日付から決まる', () => {
    expect(rateKey('CNY', '2026-09-12')).toBe('CNY:JPY:2026-09-12');
  });

  it('保存して読み戻せる', async () => {
    await putCachedRate({
      key: rateKey('CNY', '2026-09-12'),
      base: 'CNY',
      quote: 'JPY',
      date: '2026-09-12',
      rate: 23.465,
      effectiveDate: '2026-09-11',
      fetchedAt: Date.now(),
      source: 'frankfurter',
    });
    expect((await getCachedRate('CNY', '2026-09-12'))?.rate).toBe(23.465);
    expect(await countCachedRates()).toBe(1);
  });

  it('同じ通貨で最も新しい日付のものを返す', async () => {
    for (const [date, rate] of [
      ['2026-09-10', 23.0],
      ['2026-09-12', 23.5],
      ['2026-09-11', 23.2],
    ] as const) {
      await putCachedRate({
        key: rateKey('CNY', date),
        base: 'CNY',
        quote: 'JPY',
        date,
        rate,
        effectiveDate: date,
        fetchedAt: 0,
        source: 'frankfurter',
      });
    }
    await putCachedRate({
      key: rateKey('KRW', '2026-12-31'),
      base: 'KRW',
      quote: 'JPY',
      date: '2026-12-31',
      rate: 0.1,
      effectiveDate: '2026-12-31',
      fetchedAt: 0,
      source: 'frankfurter',
    });

    const latest = await latestCachedRate('CNY');
    expect(latest?.date).toBe('2026-09-12');
  });

  it('キャッシュが無ければ undefined', async () => {
    expect(await latestCachedRate('CNY')).toBeUndefined();
    expect(await getCachedRate('CNY', '2026-09-12')).toBeUndefined();
  });
});
