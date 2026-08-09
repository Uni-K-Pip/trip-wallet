import { describe, it, expect } from 'vitest';
import {
  minorToMajor,
  formatMajor,
  parseMajorToMinor,
  toJpy,
  formatJpy,
  formatWithCurrency,
} from './money';

describe('minorToMajor', () => {
  it('小数 2 桁の通貨を戻す', () => {
    expect(minorToMajor(1234, 2)).toBe(12.34);
  });

  it('小数 0 桁の通貨はそのまま', () => {
    expect(minorToMajor(1500, 0)).toBe(1500);
  });
});

describe('formatMajor', () => {
  it('小数 2 桁で表示する', () => {
    expect(formatMajor(1234, 2)).toBe('12.34');
  });

  it('端数を 0 埋めする', () => {
    expect(formatMajor(1200, 2)).toBe('12.00');
    expect(formatMajor(5, 2)).toBe('0.05');
  });

  it('3 桁区切りを入れる', () => {
    expect(formatMajor(120000, 2)).toBe('1,200.00');
    expect(formatMajor(50000, 0)).toBe('50,000');
  });
});

describe('parseMajorToMinor', () => {
  it('小数入力を最小単位にする', () => {
    expect(parseMajorToMinor('12.34', 2)).toBe(1234);
    expect(parseMajorToMinor('12.3', 2)).toBe(1230);
    expect(parseMajorToMinor('120', 2)).toBe(12000);
  });

  it('小数 0 桁の通貨は四捨五入する', () => {
    expect(parseMajorToMinor('1500', 0)).toBe(1500);
    expect(parseMajorToMinor('1500.6', 0)).toBe(1501);
  });

  it('入力途中や空文字は 0 にする', () => {
    expect(parseMajorToMinor('', 2)).toBe(0);
    expect(parseMajorToMinor('.', 2)).toBe(0);
    expect(parseMajorToMinor('12.', 2)).toBe(1200);
    expect(parseMajorToMinor('abc', 2)).toBe(0);
  });

  it('浮動小数の誤差を持ち込まない', () => {
    expect(parseMajorToMinor('0.29', 2)).toBe(29);
    expect(parseMajorToMinor('1.005', 2)).toBe(101);
  });
});

describe('toJpy', () => {
  it('レートを掛けて円に丸める', () => {
    // 120.00 元 × 23.465 = 2815.8 → 2816
    expect(toJpy(12000, 2, 23.465)).toBe(2816);
  });

  it('1 円未満は 0 になる', () => {
    expect(toJpy(1, 2, 23.465)).toBe(0);
  });

  it('小数 0 桁の通貨も扱える', () => {
    // 10000 ウォン × 0.1085 = 1085
    expect(toJpy(10000, 0, 0.1085)).toBe(1085);
  });

  it('金額 0 は 0', () => {
    expect(toJpy(0, 2, 23.465)).toBe(0);
  });
});

describe('formatJpy', () => {
  it('通貨記号と 3 桁区切りを付ける', () => {
    expect(formatJpy(2816)).toBe('¥2,816');
    expect(formatJpy(0)).toBe('¥0');
    expect(formatJpy(1234567)).toBe('¥1,234,567');
  });

  it('負の値は記号の前に符号を置く', () => {
    expect(formatJpy(-1200)).toBe('-¥1,200');
  });
});

describe('formatWithCurrency', () => {
  it('通貨記号付きで表示する', () => {
    expect(formatWithCurrency(12000, 'CNY')).toBe('120.00元');
    expect(formatWithCurrency(15000, 'KRW')).toBe('₩15,000');
  });
});
