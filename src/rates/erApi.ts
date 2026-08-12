import { toIsoDate } from '../domain/date';
import type { FetchedRate } from './types';

const BASE_URL = 'https://open.er-api.com/v6/latest';

// 応答は小数 4〜5 桁で丸められる。この閾値を下回るレートは有効桁が足りないので
// 逆方向(quote → base)を引いて逆数を取る。
const PRECISION_FLOOR = 0.1;

async function fetchLatest(
  base: string,
  quote: string,
  fallbackDate: string,
  fetchImpl: typeof fetch,
): Promise<FetchedRate> {
  const res = await fetchImpl(`${BASE_URL}/${base}`);
  if (!res.ok) throw new Error(`er-api が ${res.status} を返した`);

  const json = (await res.json()) as {
    result?: string;
    time_last_update_unix?: number;
    rates?: Record<string, number>;
  };
  if (json.result === 'error') throw new Error('er-api がエラーを返した');

  const rate = json.rates?.[quote];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`er-api が ${quote} のレートを返さなかった`);
  }

  const unix = json.time_last_update_unix;
  const effectiveDate =
    typeof unix === 'number' ? toIsoDate(new Date(unix * 1000)) : fallbackDate;
  return { rate, effectiveDate };
}

/**
 * Frankfurter が落ちているときの当日レート用フォールバック。
 * 当日以外(過去日・未来日とも)では使わないこと。呼び出し側は当日のみで使うこと。
 */
export async function fetchErApiRate(
  base: string,
  quote: string,
  fallbackDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedRate> {
  const direct = await fetchLatest(base, quote, fallbackDate, fetchImpl);
  if (direct.rate >= PRECISION_FLOOR) return direct;

  try {
    const reverse = await fetchLatest(quote, base, fallbackDate, fetchImpl);
    return { rate: 1 / reverse.rate, effectiveDate: reverse.effectiveDate };
  } catch {
    // 2 回目が落ちても 1 回目の値は使える。精度は落ちるが取得できないよりよい。
    return direct;
  }
}
