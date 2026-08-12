import { describe, it, expect, beforeEach } from 'vitest';
import { loadLang, saveLang, loadHomeCurrency, saveHomeCurrency } from './settings';

describe('言語の保存', () => {
  beforeEach(() => localStorage.clear());

  it('未保存なら null', () => {
    expect(loadLang()).toBeNull();
  });

  it('保存した言語を読み戻す', () => {
    saveLang('ko');
    expect(loadLang()).toBe('ko');
  });

  it('壊れた値は null 扱いにする', () => {
    localStorage.setItem('trip-wallet:lang', 'xx');
    expect(loadLang()).toBeNull();
  });
});

describe('換算先通貨の保存', () => {
  beforeEach(() => localStorage.clear());

  it('未保存なら null', () => {
    expect(loadHomeCurrency()).toBeNull();
  });

  it('保存した通貨を読み戻す', () => {
    saveHomeCurrency('USD');
    expect(loadHomeCurrency()).toBe('USD');
  });

  it('対応していない通貨は null 扱いにする', () => {
    localStorage.setItem('trip-wallet:home-currency', 'XXX');
    expect(loadHomeCurrency()).toBeNull();
  });
});
