import { describe, it, expect } from 'vitest';
import type { Expense, Trip } from './types';
import {
  expenseHome,
  myShareHome,
  summarize,
  breakdownByCategory,
  dailySeries,
  groupByDate,
} from './summary';

const trip: Trip = {
  id: 't1',
  name: '上海 2026-09',
  currency: 'CNY',
  currencyDecimals: 2,
  homeCurrency: 'JPY',
  homeCurrencyDecimals: 0,
  startDate: '2026-09-12',
  endDate: '2026-09-15',
  personalBudgetHome: 100000,
  sharedBudgetHome: 50000,
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

describe('expenseHome', () => {
  it('支出に焼き付いたレートで換算する', () => {
    expect(expenseHome(expense(), trip)).toBe(2000);
  });

  it('支出ごとにレートが違っても各自のレートを使う', () => {
    expect(expenseHome(expense({ rate: 25 }), trip)).toBe(2500);
  });
});

describe('myShareHome', () => {
  it('個別はそのままの額', () => {
    expect(myShareHome(expense(), trip)).toBe(2000);
  });

  it('共有は人数で割る', () => {
    expect(myShareHome(expense({ scope: 'shared' }), trip)).toBe(1000);
  });

  it('割り切れないときは 1 件ごとに四捨五入する', () => {
    // 2000 円 / 3 人 = 666.67 → 667 円
    expect(myShareHome(expense({ scope: 'shared' }), { ...trip, memberCount: 3 })).toBe(667);
  });

  it('人数が 0 でも 0 除算しない', () => {
    expect(myShareHome(expense({ scope: 'shared' }), { ...trip, memberCount: 0 })).toBe(2000);
  });
});

describe('summarize', () => {
  it('支出が無いときはすべて 0、残額は予算のまま', () => {
    const s = summarize([], trip);
    expect(s.count).toBe(0);
    expect(s.totalMinor).toBe(0);
    expect(s.totalHome).toBe(0);
    expect(s.myTotalHome).toBe(0);
    expect(s.personalRemainingHome).toBe(100000);
    expect(s.sharedRemainingHome).toBe(50000);
  });

  it('個別と共有を分けて集計し、共有は人数で割る', () => {
    const s = summarize(
      [expense({ amountMinor: 10000 }), expense({ amountMinor: 20000, scope: 'shared' })],
      trip,
    );
    expect(s.count).toBe(2);
    expect(s.totalMinor).toBe(30000);
    expect(s.personalHome).toBe(2000);
    expect(s.sharedHome).toBe(4000);
    expect(s.sharedPerPersonHome).toBe(2000);
    expect(s.myTotalHome).toBe(4000);
    expect(s.totalHome).toBe(6000);
  });

  it('個別の残額は個別支出だけを引く', () => {
    const s = summarize(
      [expense({ amountMinor: 10000 }), expense({ amountMinor: 20000, scope: 'shared' })],
      trip,
    );
    expect(s.personalBudgetHome).toBe(100000);
    expect(s.personalRemainingHome).toBe(98000);
  });

  it('共有の残額は人数割り後の自己負担を引く', () => {
    // 共有 4000 円 / 2 人 = 自己負担 2000 円
    const s = summarize([expense({ amountMinor: 20000, scope: 'shared' })], trip);
    expect(s.sharedBudgetHome).toBe(50000);
    expect(s.sharedRemainingHome).toBe(48000);
  });

  it('予算未設定なら残額は null。片方だけ設定もできる', () => {
    const none = summarize([expense()], {
      ...trip,
      personalBudgetHome: null,
      sharedBudgetHome: null,
    });
    expect(none.personalRemainingHome).toBeNull();
    expect(none.sharedRemainingHome).toBeNull();

    const personalOnly = summarize([expense()], { ...trip, sharedBudgetHome: null });
    expect(personalOnly.personalRemainingHome).toBe(98000);
    expect(personalOnly.sharedRemainingHome).toBeNull();
  });

  it('人数が 0 でも 0 除算しない', () => {
    const s = summarize([expense({ scope: 'shared' })], { ...trip, memberCount: 0 });
    expect(s.sharedPerPersonHome).toBe(2000);
  });

  it('共有の自己負担は 1 件ずつ割ってから足す', () => {
    // 2000 円 / 3 人 = 667 円が 2 件で 1334 円。先に合計 4000 円を割ると 1333 円になり、
    // カテゴリ別・日別の積み上げと合わなくなる。
    const s = summarize([expense({ scope: 'shared' }), expense({ scope: 'shared' })], {
      ...trip,
      memberCount: 3,
    });
    expect(s.sharedPerPersonHome).toBe(1334);
    expect(s.myTotalHome).toBe(1334);
  });

  it('合計は行ごとに丸めた円の和にする(表示と一致させるため)', () => {
    // 0.03 元 × 23.465 = 0.70395 → 行の表示は 1 円。2 行なので合計 2 円。
    // 先に合計してから丸めると 1 円になり、画面の行と合わない。
    const es = [
      expense({ amountMinor: 3, rate: 23.465 }),
      expense({ amountMinor: 3, rate: 23.465 }),
    ];
    expect(summarize(es, trip).totalHome).toBe(2);
  });

  it('換算先が小数 2 桁ならセント単位で集計する', () => {
    const t: Trip = {
      ...trip,
      currency: 'CNY',
      currencyDecimals: 2,
      homeCurrency: 'USD',
      homeCurrencyDecimals: 2,
    };
    // 120.00 元 × 0.1405 = 16.86 ドル
    const s = summarize([expense({ amountMinor: 12000, rate: 0.1405, scope: 'personal' })], t);
    expect(s.totalHome).toBe(1686);
    expect(s.personalHome).toBe(1686);
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
      'mine',
    );
    expect(rows.map((r) => r.category)).toEqual(['transport', 'food']);
    expect(rows[0].home).toBe(4000);
    expect(rows[0].ratio).toBeCloseTo(2 / 3, 5);
  });

  it('同じカテゴリはまとめる', () => {
    const rows = breakdownByCategory(
      [expense({ category: 'food' }), expense({ category: 'food' })],
      trip,
      'mine',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].home).toBe(4000);
  });

  it('支出が無ければ空配列', () => {
    expect(breakdownByCategory([], trip, 'mine')).toEqual([]);
  });

  it('個別は共有を除く', () => {
    const rows = breakdownByCategory(
      [expense({ category: 'food' }), expense({ category: 'transport', scope: 'shared' })],
      trip,
      'personal',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('food');
    expect(rows[0].home).toBe(2000);
  });

  it('共有は人数で割らない支払総額', () => {
    const rows = breakdownByCategory(
      [expense({ category: 'food' }), expense({ category: 'transport', scope: 'shared' })],
      trip,
      'shared',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('transport');
    expect(rows[0].home).toBe(2000);
  });

  it('自己負担は共有を人数で割って個別と混ぜる', () => {
    const rows = breakdownByCategory(
      [expense({ category: 'food' }), expense({ category: 'transport', scope: 'shared' })],
      trip,
      'mine',
    );
    expect(rows.map((r) => r.category)).toEqual(['food', 'transport']);
    expect(rows[0].home).toBe(2000);
    expect(rows[1].home).toBe(1000);
    expect(rows[0].ratio).toBeCloseTo(2 / 3, 5);
  });

  it('選んだスコープに該当が無ければ空配列', () => {
    expect(breakdownByCategory([expense()], trip, 'shared')).toEqual([]);
  });
});

describe('dailySeries', () => {
  it('支出のない日を 0 円で埋める', () => {
    const s = dailySeries(
      [expense({ date: '2026-09-12' }), expense({ date: '2026-09-15' })],
      trip,
      'mine',
    );
    expect(s.points.map((p) => p.date)).toEqual([
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
    ]);
    expect(s.points.map((p) => p.home)).toEqual([2000, 0, 0, 2000]);
  });

  it('範囲は旅行期間ではなく最初と最後の支出日', () => {
    // 旅行は 9/12〜9/15 だが支出は 9/13 の 1 件だけ。まだ来ていない日は出さない。
    const s = dailySeries([expense({ date: '2026-09-13' })], trip, 'mine');
    expect(s.points.map((p) => p.date)).toEqual(['2026-09-13']);
  });

  it('平均は 0 円の日も分母に入れる', () => {
    const s = dailySeries(
      [expense({ date: '2026-09-12' }), expense({ date: '2026-09-14' })],
      trip,
      'mine',
    );
    expect(s.totalHome).toBe(4000);
    expect(s.averageHome).toBe(1333); // 4000 / 3 日
  });

  it('最高額の日を返す。同額なら先の日', () => {
    const s = dailySeries(
      [
        expense({ date: '2026-09-12', amountMinor: 5000 }),
        expense({ date: '2026-09-13', amountMinor: 20000 }),
        expense({ date: '2026-09-14', amountMinor: 20000 }),
      ],
      trip,
      'mine',
    );
    expect(s.maxHome).toBe(4000);
    expect(s.peakDate).toBe('2026-09-13');
  });

  it('表示スコープで対象を絞る', () => {
    const s = dailySeries(
      [expense({ date: '2026-09-12' }), expense({ date: '2026-09-13', scope: 'shared' })],
      trip,
      'shared',
    );
    expect(s.points).toEqual([{ date: '2026-09-13', home: 2000 }]);
  });

  it('選んだスコープに該当が無ければ空', () => {
    expect(dailySeries([expense()], trip, 'shared')).toEqual({
      points: [],
      totalHome: 0,
      maxHome: 0,
      peakDate: null,
      averageHome: 0,
    });
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
    expect(groups[1].home).toBe(4000);
  });
});
