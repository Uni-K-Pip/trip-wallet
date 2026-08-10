import type { Trip } from '../domain/types';

const STORAGE_KEY = 'trip-wallet:export-reminder-dismissed';

export function readDismissedReminder(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function dismissReminder(tripId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, tripId);
  } catch {
    // 保存できなくても表示の妨げにはしない
  }
}

/**
 * 旅行の終了日を過ぎたらエクスポートを促す。
 * iOS Safari は使わない期間が続くとストレージを消すことがあるため。
 * 日付は "YYYY-MM-DD" 固定長なので文字列比較で大小がそのまま比べられる。
 */
export function needsExportReminder(
  trip: Trip | null,
  today: string,
  dismissedFor: string | null,
): boolean {
  if (trip === null || trip.endDate === null) return false;
  if (dismissedFor === trip.id) return false;
  return trip.endDate <= today;
}
