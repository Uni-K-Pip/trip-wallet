export type CurrencyInfo = {
  code: string;
  /** 最小単位の桁数 */
  decimals: number;
  label: string;
  symbol: string;
};

// レート取得は Frankfurter(ECB 参照レート)が主なので、ECB が公表する通貨だけを載せる。
// 台湾ドル(TWD)・ベトナムドン(VND)・インドネシアルピア(IDR)は ECB の対象外で
// レートを取得できないため、ここに追加してはいけない。
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'CNY', decimals: 2, label: '中国元', symbol: '元' },
  { code: 'KRW', decimals: 0, label: '韓国ウォン', symbol: '₩' },
  { code: 'USD', decimals: 2, label: '米ドル', symbol: '$' },
  { code: 'EUR', decimals: 2, label: 'ユーロ', symbol: '€' },
  { code: 'THB', decimals: 2, label: 'タイバーツ', symbol: '฿' },
  { code: 'HKD', decimals: 2, label: '香港ドル', symbol: 'HK$' },
  { code: 'SGD', decimals: 2, label: 'シンガポールドル', symbol: 'S$' },
  { code: 'GBP', decimals: 2, label: '英ポンド', symbol: '£' },
  { code: 'AUD', decimals: 2, label: '豪ドル', symbol: 'A$' },
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
