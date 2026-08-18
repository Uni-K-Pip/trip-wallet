import { readLocal, writeLocal } from './localStore';

const TWA_KEY = 'trip-wallet:twa';

/**
 * Play 版(TWA)の packageId。TWA からの起動だけ referrer がこの値になる。
 * `twa/twa-manifest.json` の packageId と必ず一致させる。ずれても型検査もテストも
 * 通ってしまうので、README の実機確認が唯一の検出手段になる。
 */
const TWA_REFERRER = 'android-app://io.github.unikpip.tripwallet';

/**
 * この読み込みで TWA 起動を観測したかどうか。
 * 保存に失敗しても、そのセッションのあいだは確実に隠す側へ倒すために持つ。
 */
let launchedFromTwa = false;

/**
 * TWA から起動されたことを記録する。
 * referrer が入るのは初回ナビゲーションだけで、SPA 内の遷移や再訪では失われる。
 * そのため起動時に一度だけ判定して localStorage に残す。
 * display-mode: standalone は PWA インストールと区別できないので使わない。
 * 前方一致にすると他の Android アプリから来たリンクを取り違えるので、完全一致で見る。
 * 保存できない端末でも隠せるよう、localStorage と変数の両方に残す。
 */
export function markTwaLaunch(): void {
  const from = document.referrer;
  if (from !== TWA_REFERRER && from !== `${TWA_REFERRER}/`) return;
  launchedFromTwa = true;
  writeLocal(TWA_KEY, '1');
}

export function isTwa(): boolean {
  return launchedFromTwa || readLocal(TWA_KEY) === '1';
}
