import type { FetchedRate } from './types';

export type { FetchedRate } from './types';

const BASE_URL = 'https://api.frankfurter.dev/v1';

// 応答は結果を丸めて返す。1 円 = 0.01 ドルのように桁が落ちるのを避けるため、
// 100 万倍で問い合わせてから割り戻す。
const AMOUNT = 1_000_000;

/**
 * ECB 参照レートを日付指定で取得する。API キー不要・CORS 許可。
 * ECB の対象外通貨(TWD など)は rates が空で返るので例外にする。
 */
export async function fetchFrankfurterRate(
  base: string,
  quote: string,
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedRate> {
  const res = await fetchImpl(`${BASE_URL}/${date}?base=${base}&symbols=${quote}&amount=${AMOUNT}`);
  if (!res.ok) throw new Error(`Frankfurter が ${res.status} を返した`);

  const json = (await res.json()) as { date?: string; rates?: Record<string, number> };
  const scaled = json.rates?.[quote];
  if (typeof scaled !== 'number' || !Number.isFinite(scaled) || scaled <= 0) {
    throw new Error(`Frankfurter が ${quote} のレートを返さなかった`);
  }
  return { rate: scaled / AMOUNT, effectiveDate: json.date ?? date };
}
