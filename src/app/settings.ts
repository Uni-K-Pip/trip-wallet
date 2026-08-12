import { findCurrency } from '../domain/currency';
import type { Lang } from '../i18n';

const LANG_KEY = 'trip-wallet:lang';
const HOME_CURRENCY_KEY = 'trip-wallet:home-currency';

// プライベートブラウジングや容量超過で localStorage は例外を投げる。
// 設定が読み書きできなくても起動と操作は止めない。
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても今回の操作は続行する
  }
}

export function loadLang(): Lang | null {
  const v = read(LANG_KEY);
  return v === 'ja' || v === 'en' || v === 'ko' || v === 'zh' ? v : null;
}

export function saveLang(lang: Lang): void {
  write(LANG_KEY, lang);
}

/** 新しい旅行の換算先の既定値。対応表にない通貨は保存済みでも捨てる。 */
export function loadHomeCurrency(): string | null {
  const v = read(HOME_CURRENCY_KEY);
  return v !== null && findCurrency(v) !== undefined ? v : null;
}

export function saveHomeCurrency(code: string): void {
  write(HOME_CURRENCY_KEY, code);
}
