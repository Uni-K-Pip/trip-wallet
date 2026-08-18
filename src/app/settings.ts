import { findCurrency } from '../domain/currency';
import type { Lang } from '../i18n';
import { readLocal, writeLocal } from './localStore';

const LANG_KEY = 'trip-wallet:lang';
const HOME_CURRENCY_KEY = 'trip-wallet:home-currency';

export function loadLang(): Lang | null {
  const v = readLocal(LANG_KEY);
  return v === 'ja' || v === 'en' || v === 'ko' || v === 'zh' ? v : null;
}

export function saveLang(lang: Lang): void {
  writeLocal(LANG_KEY, lang);
}

/** 新しい旅行の換算先の既定値。対応表にない通貨は保存済みでも捨てる。 */
export function loadHomeCurrency(): string | null {
  const v = readLocal(HOME_CURRENCY_KEY);
  return v !== null && findCurrency(v) !== undefined ? v : null;
}

export function saveHomeCurrency(code: string): void {
  writeLocal(HOME_CURRENCY_KEY, code);
}
