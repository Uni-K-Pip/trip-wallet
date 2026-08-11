import { describe, it, expect } from 'vitest';
import { migrateTrip } from './migrateTrip';

const v1Trip = {
  id: 't1',
  name: '上海 2026-09',
  currency: 'CNY',
  currencyDecimals: 2,
  startDate: '2026-09-12',
  endDate: null,
  budgetJpy: 100000,
  memberCount: 2,
  createdAt: 0,
};

const v2Trip = {
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
};

describe('migrateTrip', () => {
  it('v1 の budgetJpy を個別予算に移す', () => {
    const t = migrateTrip({ ...v1Trip });
    expect(t.personalBudgetHome).toBe(100000);
    expect(t.sharedBudgetHome).toBeNull();
  });

  it('予算未設定の v1 は個別・共有とも null', () => {
    const t = migrateTrip({ ...v1Trip, budgetJpy: null });
    expect(t.personalBudgetHome).toBeNull();
    expect(t.sharedBudgetHome).toBeNull();
  });

  it('v2 の予算を換算先通貨の予算として引き継ぐ(円は小数 0 桁なので値は変えない)', () => {
    const t = migrateTrip({ ...v2Trip });
    expect(t.personalBudgetHome).toBe(50000);
    expect(t.sharedBudgetHome).toBe(30000);
  });

  it('換算先通貨が無ければ円にする', () => {
    const t = migrateTrip({ ...v2Trip });
    expect(t.homeCurrency).toBe('JPY');
    expect(t.homeCurrencyDecimals).toBe(0);
  });

  it('v3 の旅行はそのまま返す', () => {
    const t = migrateTrip({
      ...v2Trip,
      personalBudgetJpy: undefined,
      sharedBudgetJpy: undefined,
      homeCurrency: 'USD',
      homeCurrencyDecimals: 2,
      personalBudgetHome: 150050,
      sharedBudgetHome: null,
    });
    expect(t.homeCurrency).toBe('USD');
    expect(t.homeCurrencyDecimals).toBe(2);
    expect(t.personalBudgetHome).toBe(150050);
    expect(t.sharedBudgetHome).toBeNull();
  });

  it('旧フィールドを残さない', () => {
    const t = migrateTrip({ ...v1Trip }) as unknown as Record<string, unknown>;
    expect('budgetJpy' in t).toBe(false);
    expect('personalBudgetJpy' in t).toBe(false);
    expect('sharedBudgetJpy' in t).toBe(false);
  });

  it('予算と通貨以外のフィールドは変えない', () => {
    const t = migrateTrip({ ...v1Trip });
    expect(t.id).toBe('t1');
    expect(t.name).toBe('上海 2026-09');
    expect(t.currency).toBe('CNY');
    expect(t.currencyDecimals).toBe(2);
    expect(t.startDate).toBe('2026-09-12');
    expect(t.endDate).toBeNull();
    expect(t.memberCount).toBe(2);
    expect(t.createdAt).toBe(0);
  });
});
