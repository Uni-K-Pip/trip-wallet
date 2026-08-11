import { describe, it, expect } from 'vitest';
import { LANGS, LANG_LABELS, detectLang, defaultHomeCurrency } from './index';

describe('LANGS', () => {
  it('4 言語を並べる', () => {
    expect(LANGS).toEqual(['ja', 'en', 'ko', 'zh']);
  });

  it('ラベルはその言語自身の表記にする', () => {
    expect(LANGS.map((l) => LANG_LABELS[l])).toEqual(['日本語', 'English', '한국어', '中文']);
  });
});

describe('detectLang', () => {
  it('先頭から対応言語を探す', () => {
    expect(detectLang(['ja-JP', 'en-US'])).toBe('ja');
    expect(detectLang(['ko-KR'])).toBe('ko');
  });

  it('地域や表記が付いた中国語も zh にまとめる', () => {
    expect(detectLang(['zh-Hant-TW'])).toBe('zh');
    expect(detectLang(['zh-CN'])).toBe('zh');
  });

  it('大文字小文字を無視する', () => {
    expect(detectLang(['JA'])).toBe('ja');
  });

  it('対応外しかなければ英語にする', () => {
    expect(detectLang(['fr-FR', 'de-DE'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });

  it('引数を省くと端末の設定を見る', () => {
    expect(detectLang()).toBe('ja');
  });
});

describe('defaultHomeCurrency', () => {
  it('言語ごとの既定の換算先を返す', () => {
    expect(defaultHomeCurrency('ja')).toBe('JPY');
    expect(defaultHomeCurrency('en')).toBe('USD');
    expect(defaultHomeCurrency('ko')).toBe('KRW');
    expect(defaultHomeCurrency('zh')).toBe('CNY');
  });
});
