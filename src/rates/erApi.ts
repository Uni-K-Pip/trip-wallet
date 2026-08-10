import { toIsoDate } from '../domain/date';
import type { FetchedRate } from './frankfurter';

/**
 * Frankfurter が落ちているときの当日レート用フォールバック。
 * 当日以外(過去日・未来日とも)では使わないこと。呼び出し側は当日のみで使うこと。
 */
export async function fetchErApiRate(
  base: string,
  fallbackDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedRate> {
  const res = await fetchImpl(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error(`er-api が ${res.status} を返した`);

  const json = (await res.json()) as {
    result?: string;
    time_last_update_unix?: number;
    rates?: Record<string, number>;
  };
  if (json.result === 'error') throw new Error('er-api がエラーを返した');

  const rate = json.rates?.JPY;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`er-api が ${base} のレートを返さなかった`);
  }

  const unix = json.time_last_update_unix;
  const effectiveDate =
    typeof unix === 'number' ? toIsoDate(new Date(unix * 1000)) : fallbackDate;
  return { rate, effectiveDate };
}
