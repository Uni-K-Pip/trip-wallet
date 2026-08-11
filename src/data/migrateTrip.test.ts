import { describe, it, expect } from 'vitest';
import { migrateTripBudget } from './migrateTrip';

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

describe('migrateTripBudget', () => {
  it('v1 の budgetJpy を個別予算に移す', () => {
    const t = migrateTripBudget({ ...v1Trip });
    expect(t.personalBudgetJpy).toBe(100000);
    expect(t.sharedBudgetJpy).toBeNull();
  });

  it('旧フィールドを残さない', () => {
    expect('budgetJpy' in migrateTripBudget({ ...v1Trip })).toBe(false);
  });

  it('予算未設定の v1 は個別・共有とも null', () => {
    const t = migrateTripBudget({ ...v1Trip, budgetJpy: null });
    expect(t.personalBudgetJpy).toBeNull();
    expect(t.sharedBudgetJpy).toBeNull();
  });

  it('予算以外のフィールドは変えない', () => {
    const t = migrateTripBudget({ ...v1Trip });
    expect(t.id).toBe('t1');
    expect(t.name).toBe('上海 2026-09');
    expect(t.currency).toBe('CNY');
    expect(t.currencyDecimals).toBe(2);
    expect(t.startDate).toBe('2026-09-12');
    expect(t.endDate).toBeNull();
    expect(t.memberCount).toBe(2);
    expect(t.createdAt).toBe(0);
  });

  it('v2 の旅行はそのまま返す', () => {
    const t = migrateTripBudget({
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
    expect(t.personalBudgetJpy).toBe(50000);
    expect(t.sharedBudgetJpy).toBe(30000);
  });
});
