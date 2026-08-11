import { describe, it, expect } from 'vitest';
import { CURRENCIES, findCurrency, currencyDecimals, currencySymbol } from './currency';

describe('CURRENCIES', () => {
  it('中国元を含む', () => {
    expect(CURRENCIES.map((c) => c.code)).toContain('CNY');
  });

  it('ECB 非対応の通貨を含まない', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).not.toContain('TWD');
    expect(codes).not.toContain('VND');
  });

  it('コードが重複しない', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('ISO 4217 コードの昇順に並んでいる', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).toEqual([...codes].sort());
  });
});

describe('currencyDecimals', () => {
  it('中国元は 2 桁', () => {
    expect(currencyDecimals('CNY')).toBe(2);
  });

  it('韓国ウォンは 0 桁', () => {
    expect(currencyDecimals('KRW')).toBe(0);
  });

  it('未知の通貨は 2 桁とみなす', () => {
    expect(currencyDecimals('XXX')).toBe(2);
  });
});

describe('findCurrency / currencySymbol', () => {
  it('未知のコードは undefined', () => {
    expect(findCurrency('XXX')).toBeUndefined();
  });

  it('記号を返す。未知ならコードをそのまま返す', () => {
    expect(currencySymbol('CNY')).toBe('元');
    expect(currencySymbol('XXX')).toBe('XXX');
  });
});
