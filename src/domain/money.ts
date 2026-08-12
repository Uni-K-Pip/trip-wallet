import { findCurrency } from './currency';

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

/**
 * 外貨の最小単位を換算先通貨の最小単位にする。換算はこの関数だけを通す。
 * 桁数は旅行に保存した値を使う(通貨マスタを後から変えても過去の数字が動かないため)。
 * 小数の丸め誤差(1.005 → 100.49999…)は parseMajorToMinor と同じく文字列経由で潰す。
 */
export function toHomeMinor(
  amountMinor: number,
  decimals: number,
  rate: number,
  homeDecimals: number,
): number {
  return Math.round(
    Number((minorToMajor(amountMinor, decimals) * rate * 10 ** homeDecimals).toFixed(4)),
  );
}

/** 通貨記号を添えた表示。後置記号の通貨は末尾に付け、負号は必ず先頭に置く。 */
export function formatWithCurrency(amountMinor: number, currency: string): string {
  const info = findCurrency(currency);
  const sign = amountMinor < 0 ? '-' : '';
  const body = formatMajor(Math.abs(amountMinor), info?.decimals ?? 2);
  const symbol = info?.symbol ?? currency;
  return info?.symbolAfter ? `${sign}${body}${symbol}` : `${sign}${symbol}${body}`;
}
