import { describe, it, expect } from 'vitest';
import {
  CURRENCIES,
  findCurrency,
  currencyDecimals,
  currencySymbol,
  currencyName,
} from './currency';

describe('CURRENCIES', () => {
  it('ECB が公表する 30 通貨を載せる', () => {
    expect(CURRENCIES).toHaveLength(30);
  });

  it('主要な通貨を含む', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).toContain('CNY');
    expect(codes).toContain('JPY');
    expect(codes).toContain('IDR');
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

  it('すべてに国旗を持たせる', () => {
    expect(CURRENCIES.every((c) => c.flag.length > 0)).toBe(true);
  });
});

describe('currencyDecimals', () => {
  it('中国元は 2 桁', () => {
    expect(currencyDecimals('CNY')).toBe(2);
  });

  it('韓国ウォン・日本円は 0 桁', () => {
    expect(currencyDecimals('KRW')).toBe(0);
    expect(currencyDecimals('JPY')).toBe(0);
  });

  it('実務で小数を使わない通貨は 0 桁に寄せる', () => {
    expect(currencyDecimals('IDR')).toBe(0);
    expect(currencyDecimals('HUF')).toBe(0);
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

  it('記号を後ろに置く通貨には symbolAfter が立つ', () => {
    expect(findCurrency('CNY')?.symbolAfter).toBe(true);
    expect(findCurrency('SEK')?.symbolAfter).toBe(true);
    expect(findCurrency('USD')?.symbolAfter).toBeUndefined();
  });
});

describe('currencyName', () => {
  it('言語ごとの通貨名を返す', () => {
    expect(currencyName('USD', 'ja')).not.toBe(currencyName('USD', 'ko'));
  });

  it('空文字は返さない', () => {
    for (const c of CURRENCIES) {
      expect(currencyName(c.code, 'en').length).toBeGreaterThan(0);
    }
  });

  it('未知のコードはコードをそのまま返す', () => {
    expect(currencyName('XXX', 'ja')).toBe('XXX');
  });
});
