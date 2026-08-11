import type { Lang } from '../i18n';

export type CurrencyInfo = {
  code: string;
  /** 最小単位の桁数。計算ではなく表示に使う */
  decimals: number;
  symbol: string;
  /** 記号を数字の後ろに置く通貨。前置が多数派なので後置だけ印を付ける */
  symbolAfter?: true;
  flag: string;
};

// レート取得は Frankfurter(ECB 参照レート)が主なので、ECB が公表する通貨だけを載せる。
// 台湾ドル(TWD)・ベトナムドン(VND)は ECB の対象外でレートを取得できないため追加してはいけない。
// ブルガリアレフ(BGN)はユーロ導入で公表が終わるため入れない。
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'AUD', decimals: 2, symbol: 'A$', flag: '🇦🇺' },
  { code: 'BRL', decimals: 2, symbol: 'R$', flag: '🇧🇷' },
  { code: 'CAD', decimals: 2, symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', decimals: 2, symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CNY', decimals: 2, symbol: '元', symbolAfter: true, flag: '🇨🇳' },
  { code: 'CZK', decimals: 2, symbol: 'Kč', symbolAfter: true, flag: '🇨🇿' },
  { code: 'DKK', decimals: 2, symbol: 'kr', symbolAfter: true, flag: '🇩🇰' },
  { code: 'EUR', decimals: 2, symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', decimals: 2, symbol: '£', flag: '🇬🇧' },
  { code: 'HKD', decimals: 2, symbol: 'HK$', flag: '🇭🇰' },
  // HUF と IDR は ISO 上は小数 2 桁だが、現地で小数を使わないので 0 桁にする
  { code: 'HUF', decimals: 0, symbol: 'Ft', symbolAfter: true, flag: '🇭🇺' },
  { code: 'IDR', decimals: 0, symbol: 'Rp', flag: '🇮🇩' },
  { code: 'ILS', decimals: 2, symbol: '₪', flag: '🇮🇱' },
  { code: 'INR', decimals: 2, symbol: '₹', flag: '🇮🇳' },
  { code: 'ISK', decimals: 0, symbol: 'kr', symbolAfter: true, flag: '🇮🇸' },
  { code: 'JPY', decimals: 0, symbol: '¥', flag: '🇯🇵' },
  { code: 'KRW', decimals: 0, symbol: '₩', flag: '🇰🇷' },
  { code: 'MXN', decimals: 2, symbol: 'MX$', flag: '🇲🇽' },
  { code: 'MYR', decimals: 2, symbol: 'RM', flag: '🇲🇾' },
  { code: 'NOK', decimals: 2, symbol: 'kr', symbolAfter: true, flag: '🇳🇴' },
  { code: 'NZD', decimals: 2, symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'PHP', decimals: 2, symbol: '₱', flag: '🇵🇭' },
  { code: 'PLN', decimals: 2, symbol: 'zł', symbolAfter: true, flag: '🇵🇱' },
  { code: 'RON', decimals: 2, symbol: 'lei', symbolAfter: true, flag: '🇷🇴' },
  { code: 'SEK', decimals: 2, symbol: 'kr', symbolAfter: true, flag: '🇸🇪' },
  { code: 'SGD', decimals: 2, symbol: 'S$', flag: '🇸🇬' },
  { code: 'THB', decimals: 2, symbol: '฿', flag: '🇹🇭' },
  { code: 'TRY', decimals: 2, symbol: '₺', flag: '🇹🇷' },
  { code: 'USD', decimals: 2, symbol: '$', flag: '🇺🇸' },
  { code: 'ZAR', decimals: 2, symbol: 'R', flag: '🇿🇦' },
];

export function findCurrency(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function currencyDecimals(code: string): number {
  return findCurrency(code)?.decimals ?? 2;
}

export function currencySymbol(code: string): string {
  return findCurrency(code)?.symbol ?? code;
}

/**
 * 通貨名をその言語で返す。30 通貨 × 4 言語を手で訳さずに済ませるため
 * Intl に任せる。未対応の環境やコードでは ISO コードをそのまま出す。
 */
export function currencyName(code: string, lang: Lang): string {
  // 未知の通貨コードはそのまま返す
  if (!findCurrency(code)) {
    return code;
  }
  try {
    return new Intl.DisplayNames([lang], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}
