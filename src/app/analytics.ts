/**
 * GoatCounter のサイトコード。差し替えるのはこの 1 行だけ。
 * 空文字のあいだは一切送信しない。型は string に固定しておく(リテラル型に潰れると空文字との比較が壊れる)。
 */
export const ANALYTICS_CODE: string = 'unikpip';

// no-cors なので応答は読めないが、送るだけなので問題ない。
// cache: 'no-store' でキャッシュされないため、キャッシュバスターの rnd パラメータは要らない。
// keepalive は、寄付リンクが別タブを開くときにリクエストが打ち切られるのを防ぐ。
// referrerPolicy は Referer ヘッダを落とすため。r パラメータを省くだけでは、既定の
// strict-origin-when-cross-origin が自サイトのオリジンをヘッダで送ってしまう。
const INIT: RequestInit = {
  mode: 'no-cors',
  cache: 'no-store',
  keepalive: true,
  referrerPolicy: 'no-referrer',
};

/**
 * GoatCounter に 1 発だけ送る。
 * 計測でアプリを止めないので、オフラインでも広告ブロッカーの下でも失敗は握りつぶす。
 */
function send(params: Record<string, string>, fetchImpl: typeof fetch, code: string): void {
  if (code === '') return;
  const query = new URLSearchParams(params).toString();
  try {
    void fetchImpl(`https://${code}.goatcounter.com/count?${query}`, INIT).catch(() => {});
  } catch {
    // 拡張機能に fetch を差し替えられて同期的に投げる環境でも、計測でアプリを止めない
  }
}

/** 起動を 1 回数える。 */
export function countLaunch(fetchImpl: typeof fetch = fetch, code: string = ANALYTICS_CODE): void {
  send({ p: '/app', t: 'launch' }, fetchImpl, code);
}

/** 寄付リンクのタップを数える。 */
export function countDonationClick(
  fetchImpl: typeof fetch = fetch,
  code: string = ANALYTICS_CODE,
): void {
  send({ p: 'donate-click', e: '1' }, fetchImpl, code);
}
