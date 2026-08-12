import { describe, it, expect } from 'vitest';
import {
  minorToMajor,
  formatMajor,
  parseMajorToMinor,
  toHomeMinor,
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

describe('toHomeMinor', () => {
  it('小数 0 桁の換算先(円)はそのまま整数になる', () => {
    // 120.00 元 × 23.465 = 2815.8 → 2816
    expect(toHomeMinor(12000, 2, 23.465, 0)).toBe(2816);
  });

  it('小数 2 桁の換算先(ドル)はセントまで持つ', () => {
    // 120.00 元 × 0.1405 = 16.86 ドル → 1686 セント
    expect(toHomeMinor(12000, 2, 0.1405, 2)).toBe(1686);
  });

  it('小数 0 桁どうしも扱える', () => {
    // 10000 ウォン × 0.1085 = 1085 円
    expect(toHomeMinor(10000, 0, 0.1085, 0)).toBe(1085);
  });

  it('金額 0 は 0', () => {
    expect(toHomeMinor(0, 2, 23.465, 2)).toBe(0);
  });

  it('換算先の最小単位に満たなければ 0 になる', () => {
    expect(toHomeMinor(1, 2, 23.465, 0)).toBe(0);
  });
});

describe('formatWithCurrency', () => {
  it('記号を前に置く通貨', () => {
    expect(formatWithCurrency(15000, 'KRW')).toBe('₩15,000');
    expect(formatWithCurrency(147242, 'USD')).toBe('$1,472.42');
  });

  it('記号を後ろに置く通貨', () => {
    expect(formatWithCurrency(12000, 'CNY')).toBe('120.00元');
    expect(formatWithCurrency(120000, 'SEK')).toBe('1,200.00kr');
  });

  it('負の値は記号より前に符号を置く', () => {
    expect(formatWithCurrency(-1200, 'JPY')).toBe('-¥1,200');
    expect(formatWithCurrency(-120000, 'CNY')).toBe('-1,200.00元');
  });

  it('未知の通貨はコードを前に置き小数 2 桁で出す', () => {
    expect(formatWithCurrency(1234, 'XXX')).toBe('XXX12.34');
  });
});
