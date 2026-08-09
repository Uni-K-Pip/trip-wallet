import { describe, it, expect } from 'vitest';
import { todayLocal, toIsoDate, parseIsoDate, formatDateLabel, addDays } from './date';

describe('todayLocal', () => {
  it('UTC ではなく端末ローカルの日付を返す', () => {
    // ローカル 9/12 00:30。UTC に変換すると 9/11 になる地域があるため
    expect(todayLocal(new Date(2026, 8, 12, 0, 30))).toBe('2026-09-12');
  });

  it('月日を 0 埋めする', () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('toIsoDate / parseIsoDate', () => {
  it('往復して同じ日付になる', () => {
    expect(toIsoDate(parseIsoDate('2026-09-12'))).toBe('2026-09-12');
  });

  it('parseIsoDate はローカル時刻の 0 時を返す', () => {
    const d = parseIsoDate('2026-09-12');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });
});

describe('formatDateLabel', () => {
  it('曜日つきの短い表記にする', () => {
    expect(formatDateLabel('2026-09-12')).toBe('9/12(土)');
  });

  it('1 桁の月日をそのまま表示する', () => {
    expect(formatDateLabel('2026-01-05')).toBe('1/5(月)');
  });
});

describe('addDays', () => {
  it('月をまたぐ', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('負の日数で戻る', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });
});
