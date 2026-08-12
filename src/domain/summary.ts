import type { Category, Expense, Trip } from './types';
import { toHomeMinor } from './money';
import { eachDate } from './date';

export type TripSummary = {
  count: number;
  /** 外貨の最小単位の合計 */
  totalMinor: number;
  totalHome: number;
  personalHome: number;
  sharedHome: number;
  /** 共有支出を人数で割った自分の負担 */
  sharedPerPersonHome: number;
  /** 個別 + 共有の自己負担 */
  myTotalHome: number;
  personalBudgetHome: number | null;
  /** 個別予算 - 個別支出。予算未設定なら null */
  personalRemainingHome: number | null;
  sharedBudgetHome: number | null;
  /** 共有予算 - 共有支出の自己負担分。予算未設定なら null */
  sharedRemainingHome: number | null;
};

/** 図に出す対象。データの Scope とは別で、mine は個別 + 共有の人数割り。 */
export type ViewScope = 'personal' | 'shared' | 'mine';

export type CategoryBreakdown = { category: Category; home: number; ratio: number };
export type DailyPoint = { date: string; home: number };
export type DailySeries = {
  /** 最初の支出日〜最後の支出日を 1 日ずつ。0 円の日も含む。日付の昇順 */
  points: DailyPoint[];
  totalHome: number;
  /** 棒の高さの基準 */
  maxHome: number;
  /** 最高額の日。同額なら先の日。points が空なら null */
  peakDate: string | null;
  /** 1 日あたりの平均。0 円の日も分母に含む */
  averageHome: number;
};
export type DateGroup = { date: string; expenses: Expense[]; home: number };

/** 支出 1 件の換算先通貨への換算。焼き付けたレートを使い、再取得しない。 */
export function expenseHome(e: Expense, trip: Trip): number {
  return toHomeMinor(e.amountMinor, trip.currencyDecimals, e.rate, trip.homeCurrencyDecimals);
}

/**
 * 支出 1 件の自己負担。共有は人数で割る。
 * 合計を割るのではなく 1 件ごとに丸めるのは、カテゴリ別・日別の積み上げと
 * 合計カードの数字を一致させるため。
 */
export function myShareHome(e: Expense, trip: Trip): number {
  const home = expenseHome(e, trip);
  if (e.scope === 'personal') return home;
  return Math.round(home / Math.max(1, trip.memberCount));
}

/** 表示スコープでの 1 件の換算先通貨。対象外の支出なら null。 */
function viewHome(e: Expense, trip: Trip, view: ViewScope): number | null {
  if (view === 'mine') return myShareHome(e, trip);
  if (view === 'personal') return e.scope === 'personal' ? expenseHome(e, trip) : null;
  return e.scope === 'shared' ? expenseHome(e, trip) : null;
}

export function summarize(expenses: Expense[], trip: Trip): TripSummary {
  let totalMinor = 0;
  let personalHome = 0;
  let sharedHome = 0;
  let sharedPerPersonHome = 0;

  for (const e of expenses) {
    totalMinor += e.amountMinor;
    // 行ごとに丸めてから足す。画面に出る各行の合計と一致させるため。
    const home = expenseHome(e, trip);
    if (e.scope === 'shared') {
      sharedHome += home;
      sharedPerPersonHome += myShareHome(e, trip);
    } else {
      personalHome += home;
    }
  }

  const totalHome = personalHome + sharedHome;

  return {
    count: expenses.length,
    totalMinor,
    totalHome,
    personalHome,
    sharedHome,
    sharedPerPersonHome,
    myTotalHome: personalHome + sharedPerPersonHome,
    personalBudgetHome: trip.personalBudgetHome,
    personalRemainingHome:
      trip.personalBudgetHome === null ? null : trip.personalBudgetHome - personalHome,
    sharedBudgetHome: trip.sharedBudgetHome,
    sharedRemainingHome:
      trip.sharedBudgetHome === null ? null : trip.sharedBudgetHome - sharedPerPersonHome,
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
    const home = viewHome(e, trip, view);
    if (home === null) continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + home);
    total += home;
  }

  return [...totals.entries()]
    .map(([category, home]) => ({ category, home, ratio: total === 0 ? 0 : home / total }))
    .sort((a, b) => b.home - a.home);
}

export function dailySeries(expenses: Expense[], trip: Trip, view: ViewScope): DailySeries {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const home = viewHome(e, trip, view);
    if (home === null) continue;
    totals.set(e.date, (totals.get(e.date) ?? 0) + home);
  }

  const dates = [...totals.keys()].sort();
  if (dates.length === 0) {
    return { points: [], totalHome: 0, maxHome: 0, peakDate: null, averageHome: 0 };
  }

  // 支出のない日も 0 円で埋める。日付が飛ぶと旅程の中でのペースが読めなくなるため。
  const points = eachDate(dates[0], dates[dates.length - 1]).map((date) => ({
    date,
    home: totals.get(date) ?? 0,
  }));

  let totalHome = 0;
  let maxHome = 0;
  let peakDate = points[0].date;
  for (const p of points) {
    totalHome += p.home;
    if (p.home > maxHome) {
      maxHome = p.home;
      peakDate = p.date;
    }
  }

  return {
    points,
    totalHome,
    maxHome,
    peakDate,
    averageHome: Math.round(totalHome / points.length),
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
        home: sorted.reduce((sum, e) => sum + expenseHome(e, trip), 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
