export type FetchedRate = {
  rate: number;
  /** API が実際に返した日付。土日祝は直近営業日になる */
  effectiveDate: string;
};

const BASE_URL = 'https://api.frankfurter.dev/v1';

/**
 * ECB 参照レートを日付指定で取得する。API キー不要・CORS 許可。
 * ECB の対象外通貨(TWD など)は rates が空で返るので例外にする。
 */
export async function fetchFrankfurterRate(
  base: string,
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedRate> {
  const res = await fetchImpl(`${BASE_URL}/${date}?base=${base}&symbols=JPY`);
  if (!res.ok) throw new Error(`Frankfurter が ${res.status} を返した`);

  const json = (await res.json()) as { date?: string; rates?: Record<string, number> };
  const rate = json.rates?.JPY;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Frankfurter が ${base} のレートを返さなかった`);
  }
  return { rate, effectiveDate: json.date ?? date };
}
