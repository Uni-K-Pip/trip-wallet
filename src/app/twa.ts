import { readLocal, writeLocal } from './localStore';

const TWA_KEY = 'trip-wallet:twa';

/** Play 版(TWA)の packageId。TWA からの起動だけ referrer がこの値になる。 */
const TWA_REFERRER = 'android-app://io.github.unikpip.tripwallet';

/**
 * TWA から起動されたことを記録する。
 * referrer が入るのは初回ナビゲーションだけで、SPA 内の遷移や再訪では失われる。
 * そのため起動時に一度だけ判定して localStorage に残す。
 * display-mode: standalone は PWA インストールと区別できないので使わない。
 * 前方一致にすると他の Android アプリから来たリンクを取り違えるので、完全一致で見る。
 */
export function markTwaLaunch(): void {
  const from = document.referrer;
  if (from !== TWA_REFERRER && from !== `${TWA_REFERRER}/`) return;
  writeLocal(TWA_KEY, '1');
}

export function isTwa(): boolean {
  return readLocal(TWA_KEY) === '1';
}
