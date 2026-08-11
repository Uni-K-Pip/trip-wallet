import type { Category, Expense, Trip } from './types';
import { toJpy } from './money';

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

export type CategoryBreakdown = { category: Category; jpy: number; ratio: number };
export type DateTotal = { date: string; jpy: number };
export type DateGroup = { date: string; expenses: Expense[]; jpy: number };

/** 支出 1 件の円換算。焼き付けたレートを使い、再取得しない。 */
export function expenseJpy(e: Expense, trip: Trip): number {
  return toJpy(e.amountMinor, trip.currencyDecimals, e.rate);
}

export function summarize(expenses: Expense[], trip: Trip): TripSummary {
  let totalMinor = 0;
  let personalJpy = 0;
  let sharedJpy = 0;

  for (const e of expenses) {
    totalMinor += e.amountMinor;
    // 行ごとに丸めてから足す。画面に出る各行の合計と一致させるため。
    const jpy = expenseJpy(e, trip);
    if (e.scope === 'shared') sharedJpy += jpy;
    else personalJpy += jpy;
  }

  const totalJpy = personalJpy + sharedJpy;
  const members = Math.max(1, trip.memberCount);
  const sharedPerPersonJpy = Math.round(sharedJpy / members);

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

export function breakdownByCategory(expenses: Expense[], trip: Trip): CategoryBreakdown[] {
  const totals = new Map<Category, number>();
  let total = 0;

  for (const e of expenses) {
    const jpy = expenseJpy(e, trip);
    totals.set(e.category, (totals.get(e.category) ?? 0) + jpy);
    total += jpy;
  }

  return [...totals.entries()]
    .map(([category, jpy]) => ({ category, jpy, ratio: total === 0 ? 0 : jpy / total }))
    .sort((a, b) => b.jpy - a.jpy);
}

export function totalsByDate(expenses: Expense[], trip: Trip): DateTotal[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    totals.set(e.date, (totals.get(e.date) ?? 0) + expenseJpy(e, trip));
  }
  return [...totals.entries()]
    .map(([date, jpy]) => ({ date, jpy }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
