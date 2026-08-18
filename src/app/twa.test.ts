import { describe, it, expect, beforeEach, vi } from 'vitest';

function setReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

// twa.ts は「この読み込みで TWA 起動を観測したか」をモジュール内に持つ。
// 本番ではページ読み込みごとに 1 度だけ読まれるので、1 件 = 1 起動として読み直す。
async function loadTwa() {
  vi.resetModules();
  return import('./twa');
}

describe('TWA 判定', () => {
  beforeEach(() => {
    localStorage.clear();
    setReferrer('');
  });

  it('referrer が無ければ TWA ではない', async () => {
    const { markTwaLaunch, isTwa } = await loadTwa();
    markTwaLaunch();
    expect(isTwa()).toBe(false);
  });

  it('自分の Android アプリから起動されたら TWA と判定する', async () => {
    const { markTwaLaunch, isTwa } = await loadTwa();
    setReferrer('android-app://io.github.unikpip.tripwallet');
    markTwaLaunch();
    expect(isTwa()).toBe(true);
  });

  it('末尾にスラッシュが付いた referrer でも TWA と判定する', async () => {
    const { markTwaLaunch, isTwa } = await loadTwa();
    setReferrer('android-app://io.github.unikpip.tripwallet/');
    markTwaLaunch();
    expect(isTwa()).toBe(true);
  });

  it('他の Android アプリからのリンクは TWA と判定しない', async () => {
    const { markTwaLaunch, isTwa } = await loadTwa();
    setReferrer('android-app://com.example.otherapp');
    markTwaLaunch();
    expect(isTwa()).toBe(false);
  });

  it('ブラウザからの通常訪問は TWA と判定しない', async () => {
    const { markTwaLaunch, isTwa } = await loadTwa();
    setReferrer('https://www.google.com/');
    markTwaLaunch();
    expect(isTwa()).toBe(false);
  });

  it('一度判定したら次に開いたときも TWA と判定する', async () => {
    const first = await loadTwa();
    setReferrer('android-app://io.github.unikpip.tripwallet');
    first.markTwaLaunch();

    // 次の起動は referrer が無い。localStorage に残っているかどうかだけで決まる
    const second = await loadTwa();
    setReferrer('');
    second.markTwaLaunch();
    expect(second.isTwa()).toBe(true);
  });

  it('localStorage に保存できなくてもそのセッションでは TWA と判定する', async () => {
    const { markTwaLaunch, isTwa } = await loadTwa();
    setReferrer('android-app://io.github.unikpip.tripwallet');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    markTwaLaunch();
    setItem.mockRestore();
    expect(isTwa()).toBe(true);
  });
});
