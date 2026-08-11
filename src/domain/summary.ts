import type { Category, Expense, Trip } from './types';
import { toJpy } from './money';
import { eachDate } from './date';

export type TripSummary = {
  count: number;
  /** 外貨の最小単位の合計 */
  totalMinor: number;
  totalJpy: number;
  personalJpy: number;
  sharedJpy: number;
  /** 共有支出を人数で割った自分の負担 */
  sharedPerPersonJpy: number;
  /** 個別 + 共有の自己負担 */
  myTotalJpy: number;
  personalBudgetJpy: number | null;
  /** 個別予算 - 個別支出。予算未設定なら null */
  personalRemainingJpy: number | null;
  sharedBudgetJpy: number | null;
  /** 共有予算 - 共有支出の自己負担分。予算未設定なら null */
  sharedRemainingJpy: number | null;
};

/** 図に出す対象。データの Scope とは別で、mine は個別 + 共有の人数割り。 */
export type ViewScope = 'personal' | 'shared' | 'mine';

export type CategoryBreakdown = { category: Category; jpy: number; ratio: number };
export type DailyPoint = { date: string; jpy: number };
export type DailySeries = {
  /** 最初の支出日〜最後の支出日を 1 日ずつ。0 円の日も含む。日付の昇順 */
  points: DailyPoint[];
  totalJpy: number;
  /** 棒の高さの基準 */
  maxJpy: number;
  /** 最高額の日。同額なら先の日。points が空なら null */
  peakDate: string | null;
  /** 1 日あたりの平均。0 円の日も分母に含む */
  averageJpy: number;
};
export type DateGroup = { date: string; expenses: Expense[]; jpy: number };

/** 支出 1 件の円換算。焼き付けたレートを使い、再取得しない。 */
export function expenseJpy(e: Expense, trip: Trip): number {
  return toJpy(e.amountMinor, trip.currencyDecimals, e.rate);
}

/**
 * 支出 1 件の自己負担。共有は人数で割る。
 * 合計を割るのではなく 1 件ごとに丸めるのは、カテゴリ別・日別の積み上げと
 * 合計カードの数字を一致させるため。
 */
export function myShareJpy(e: Expense, trip: Trip): number {
  const jpy = expenseJpy(e, trip);
  if (e.scope === 'personal') return jpy;
  return Math.round(jpy / Math.max(1, trip.memberCount));
}

/** 表示スコープでの 1 件の円。対象外の支出なら null。 */
function viewJpy(e: Expense, trip: Trip, view: ViewScope): number | null {
  if (view === 'mine') return myShareJpy(e, trip);
  if (view === 'personal') return e.scope === 'personal' ? expenseJpy(e, trip) : null;
  return e.scope === 'shared' ? expenseJpy(e, trip) : null;
}

export function summarize(expenses: Expense[], trip: Trip): TripSummary {
  let totalMinor = 0;
  let personalJpy = 0;
  let sharedJpy = 0;
  let sharedPerPersonJpy = 0;

  for (const e of expenses) {
    totalMinor += e.amountMinor;
    // 行ごとに丸めてから足す。画面に出る各行の合計と一致させるため。
    const jpy = expenseJpy(e, trip);
    if (e.scope === 'shared') {
      sharedJpy += jpy;
      sharedPerPersonJpy += myShareJpy(e, trip);
    } else {
      personalJpy += jpy;
    }
  }

  const totalJpy = personalJpy + sharedJpy;

  return {
    count: expenses.length,
    totalMinor,
    totalJpy,
    personalJpy,
    sharedJpy,
    sharedPerPersonJpy,
    myTotalJpy: personalJpy + sharedPerPersonJpy,
    personalBudgetJpy: trip.personalBudgetJpy,
    personalRemainingJpy:
      trip.personalBudgetJpy === null ? null : trip.personalBudgetJpy - personalJpy,
    sharedBudgetJpy: trip.sharedBudgetJpy,
    sharedRemainingJpy:
      trip.sharedBudgetJpy === null ? null : trip.sharedBudgetJpy - sharedPerPersonJpy,
  };
}

export function breakdownByCategory(
  expenses: Expense[],
  trip: Trip,
  view: ViewScope,
): CategoryBreakdown[] {
  const totals = new Map<Category, number>();
  let total = 0;

  for (const e of expenses) {
    const jpy = viewJpy(e, trip, view);
    if (jpy === null) continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + jpy);
    total += jpy;
  }

  return [...totals.entries()]
    .map(([category, jpy]) => ({ category, jpy, ratio: total === 0 ? 0 : jpy / total }))
    .sort((a, b) => b.jpy - a.jpy);
}

export function dailySeries(expenses: Expense[], trip: Trip, view: ViewScope): DailySeries {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const jpy = viewJpy(e, trip, view);
    if (jpy === null) continue;
    totals.set(e.date, (totals.get(e.date) ?? 0) + jpy);
  }

  const dates = [...totals.keys()].sort();
  if (dates.length === 0) {
    return { points: [], totalJpy: 0, maxJpy: 0, peakDate: null, averageJpy: 0 };
  }

  // 支出のない日も 0 円で埋める。日付が飛ぶと旅程の中でのペースが読めなくなるため。
  const points = eachDate(dates[0], dates[dates.length - 1]).map((date) => ({
    date,
    jpy: totals.get(date) ?? 0,
  }));

  let totalJpy = 0;
  let maxJpy = 0;
  let peakDate = points[0].date;
  for (const p of points) {
    totalJpy += p.jpy;
    if (p.jpy > maxJpy) {
      maxJpy = p.jpy;
      peakDate = p.date;
    }
  }

  return {
    points,
    totalJpy,
    maxJpy,
    peakDate,
    averageJpy: Math.round(totalJpy / points.length),
  };
}

export function groupByDate(expenses: Expense[], trip: Trip): DateGroup[] {
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    const list = groups.get(e.date);
    if (list) list.push(e);
    else groups.set(e.date, [e]);
  }

  return [...groups.entries()]
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
      return {
        date,
        expenses: sorted,
        jpy: sorted.reduce((sum, e) => sum + expenseJpy(e, trip), 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
