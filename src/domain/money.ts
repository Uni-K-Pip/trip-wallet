import { currencyDecimals, currencySymbol } from './currency';

function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function minorToMajor(amountMinor: number, decimals: number): number {
  return amountMinor / 10 ** decimals;
}

/** 最小単位の整数を表示用の文字列にする。"1,200.00" など。 */
export function formatMajor(amountMinor: number, decimals: number): string {
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(amountMinor));
  const unit = 10 ** decimals;
  const head = group(Math.floor(abs / unit));
  if (decimals === 0) return sign + head;
  const frac = String(abs % unit).padStart(decimals, '0');
  return `${sign}${head}.${frac}`;
}

/** テンキーからの入力文字列を最小単位の整数にする。不正な入力は 0 とみなす。 */
export function parseMajorToMinor(input: string, decimals: number): number {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '.') return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return 0;
  // 小数の丸め誤差(1.005 * 100 = 100.49999…)を避けるため文字列経由で丸める
  return Math.round(Number((value * 10 ** decimals).toFixed(4)));
}

/** 外貨の最小単位を円に換算する。円換算はこの関数だけを通す。 */
export function toJpy(amountMinor: number, decimals: number, rate: number): number {
  return Math.round(minorToMajor(amountMinor, decimals) * rate);
}

export function formatJpy(jpy: number): string {
  const rounded = Math.round(jpy);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}¥${group(Math.abs(rounded))}`;
}

/** 通貨記号を添えた外貨表示。記号が後置の通貨(元)は末尾に付ける。 */
export function formatWithCurrency(amountMinor: number, currency: string): string {
  const body = formatMajor(amountMinor, currencyDecimals(currency));
  const symbol = currencySymbol(currency);
  return currency === 'CNY' ? `${body}${symbol}` : `${symbol}${body}`;
}
