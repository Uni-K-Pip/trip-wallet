import { describe, it, expect } from 'vitest';
import type { Expense, Trip } from './types';
import {
  expenseJpy,
  summarize,
  breakdownByCategory,
  totalsByDate,
  groupByDate,
} from './summary';

const trip: Trip = {
  id: 't1',
  name: '上海 2026-09',
  currency: 'CNY',
  currencyDecimals: 2,
  startDate: '2026-09-12',
  endDate: '2026-09-15',
  budgetJpy: 100000,
  memberCount: 2,
  createdAt: 0,
};

let seq = 0;
function expense(over: Partial<Expense> = {}): Expense {
  seq += 1;
  return {
    id: `e${seq}`,
    tripId: 't1',
    date: '2026-09-12',
    amountMinor: 10000, // 100.00 元
    scope: 'personal',
    category: 'food',
    payment: 'cash',
    memo: '',
    rate: 20, // 1 元 = 20 円 → 2000 円
    rateSource: 'api',
    photoId: null,
    createdAt: seq,
    updatedAt: seq,
    ...over,
  };
}

describe('expenseJpy', () => {
  it('支出に焼き付いたレートで換算する', () => {
    expect(expenseJpy(expense(), trip)).toBe(2000);
  });

  it('支出ごとにレートが違っても各自のレートを使う', () => {
    expect(expenseJpy(expense({ rate: 25 }), trip)).toBe(2500);
  });
});

describe('summarize', () => {
  it('支出が無いときはすべて 0、残額は予算のまま', () => {
    const s = summarize([], trip);
    expect(s.count).toBe(0);
    expect(s.totalMinor).toBe(0);
    expect(s.totalJpy).toBe(0);
    expect(s.myTotalJpy).toBe(0);
    expect(s.remainingJpy).toBe(100000);
  });

  it('個別と共有を分けて集計し、共有は人数で割る', () => {
    const s = summarize(
      [expense({ amountMinor: 10000 }), expense({ amountMinor: 20000, scope: 'shared' })],
      trip,
    );
    expect(s.count).toBe(2);
    expect(s.totalMinor).toBe(30000);
    expect(s.personalJpy).toBe(2000);
    expect(s.sharedJpy).toBe(4000);
    expect(s.sharedPerPersonJpy).toBe(2000);
    expect(s.myTotalJpy).toBe(4000);
    expect(s.totalJpy).toBe(6000);
  });

  it('残額は支出合計(自己負担ではない)を予算から引く', () => {
    const s = summarize([expense({ amountMinor: 20000, scope: 'shared' })], trip);
    expect(s.remainingJpy).toBe(96000);
  });

  it('予算未設定なら残額は null', () => {
    const s = summarize([expense()], { ...trip, budgetJpy: null });
    expect(s.remainingJpy).toBeNull();
  });

  it('人数が 0 でも 0 除算しない', () => {
    const s = summarize([expense({ scope: 'shared' })], { ...trip, memberCount: 0 });
    expect(s.sharedPerPersonJpy).toBe(2000);
  });

  it('合計は行ごとに丸めた円の和にする(表示と一致させるため)', () => {
    // 0.03 元 × 23.465 = 0.70395 → 行の表示は 1 円。2 行なので合計 2 円。
    // 先に合計してから丸めると 1 円になり、画面の行と合わない。
    const es = [
      expense({ amountMinor: 3, rate: 23.465 }),
      expense({ amountMinor: 3, rate: 23.465 }),
    ];
    expect(summarize(es, trip).totalJpy).toBe(2);
  });
});

describe('breakdownByCategory', () => {
  it('金額の多い順に並べ、構成比を付ける', () => {
    const rows = breakdownByCategory(
      [
        expense({ amountMinor: 10000, category: 'food' }),
        expense({ amountMinor: 20000, category: 'transport' }),
      ],
      trip,
    );
    expect(rows.map((r) => r.category)).toEqual(['transport', 'food']);
    expect(rows[0].jpy).toBe(4000);
    expect(rows[0].ratio).toBeCloseTo(2 / 3, 5);
  });

  it('同じカテゴリはまとめる', () => {
    const rows = breakdownByCategory(
      [expense({ category: 'food' }), expense({ category: 'food' })],
      trip,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].jpy).toBe(4000);
  });

  it('支出が無ければ空配列', () => {
    expect(breakdownByCategory([], trip)).toEqual([]);
  });
});

describe('totalsByDate', () => {
  it('日付の昇順で日別合計を返す', () => {
    const rows = totalsByDate(
      [expense({ date: '2026-09-13' }), expense({ date: '2026-09-12' })],
      trip,
    );
    expect(rows.map((r) => r.date)).toEqual(['2026-09-12', '2026-09-13']);
    expect(rows[0].jpy).toBe(2000);
  });
});

describe('groupByDate', () => {
  it('日付の降順にまとめ、各日の中は新しい順にする', () => {
    const older = expense({ date: '2026-09-12', createdAt: 1, id: 'old' });
    const newer = expense({ date: '2026-09-12', createdAt: 2, id: 'new' });
    const other = expense({ date: '2026-09-13', id: 'other' });
    const groups = groupByDate([older, other, newer], trip);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-13', '2026-09-12']);
    expect(groups[1].expenses.map((e) => e.id)).toEqual(['new', 'old']);
    expect(groups[1].jpy).toBe(4000);
  });
});
