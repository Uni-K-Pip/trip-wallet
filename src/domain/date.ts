/** Date を端末ローカルの "YYYY-MM-DD" にする。toISOString は UTC になるので使わない。 */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今日の日付。旅行中は端末の時計が現地時刻になっている前提で時差補正はしない。 */
export function todayLocal(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** "YYYY-MM-DD" をローカル時刻 0 時の Date にする。 */
export function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 日付ラベルの組み立てに要る辞書の一部。date.ts は i18n を import せず構造的型で受ける。 */
export type DateLabelDict = {
  weekdays: readonly string[];
  dateLabel: (month: number, day: number, weekday: string) => string;
};

/** "2026-09-12" → ja なら "9/12(土)"、en なら "Sat, 9/12"。曜日名も並びも辞書が決める。 */
export function formatDateLabel(isoDate: string, dict: DateLabelDict): string {
  const d = parseIsoDate(isoDate);
  return dict.dateLabel(d.getMonth() + 1, d.getDate(), dict.weekdays[d.getDay()]);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseIsoDate(isoDate);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** from〜to を 1 日ずつ並べた ISO 日付。to が from より前なら空。ISO 文字列は辞書順で日付順になる。 */
export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = from;
  while (cur <= to) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

export function dayOfMonth(isoDate: string): number {
  return parseIsoDate(isoDate).getDate();
}

/** 0=日 〜 6=土 */
export function weekdayIndex(isoDate: string): number {
  return parseIsoDate(isoDate).getDay();
}
