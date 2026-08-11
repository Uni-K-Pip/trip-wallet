import { describe, it, expect, beforeEach } from 'vitest';
import type { Trip } from '../domain/types';
import { dismissReminder, needsExportReminder, readDismissedReminder } from './reminders';

function trip(patch: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    name: '上海',
    currency: 'CNY',
    currencyDecimals: 2,
    homeCurrency: 'JPY',
    homeCurrencyDecimals: 0,
    startDate: '2026-09-12',
    endDate: '2026-09-16',
    personalBudgetHome: null,
    sharedBudgetHome: null,
    memberCount: 1,
    createdAt: 0,
    ...patch,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('needsExportReminder', () => {
  it('旅行が無ければ出さない', () => {
    expect(needsExportReminder(null, '2026-09-20', null)).toBe(false);
  });

  it('終了日が未設定なら出さない', () => {
    expect(needsExportReminder(trip({ endDate: null }), '2026-09-20', null)).toBe(false);
  });

  it('終了日より前なら出さない', () => {
    expect(needsExportReminder(trip(), '2026-09-15', null)).toBe(false);
  });

  it('終了日当日なら出す', () => {
    expect(needsExportReminder(trip(), '2026-09-16', null)).toBe(true);
  });

  it('終了日を過ぎたら出す', () => {
    expect(needsExportReminder(trip(), '2026-09-20', null)).toBe(true);
  });

  it('一度閉じた旅行では出さない', () => {
    expect(needsExportReminder(trip(), '2026-09-20', 'trip-1')).toBe(false);
  });

  it('別の旅行を閉じていても出す', () => {
    expect(needsExportReminder(trip(), '2026-09-20', 'trip-9')).toBe(true);
  });
});

describe('閉じた状態の保存', () => {
  it('保存した旅行 id を読み戻せる', () => {
    expect(readDismissedReminder()).toBeNull();
    dismissReminder('trip-1');
    expect(readDismissedReminder()).toBe('trip-1');
  });
});
