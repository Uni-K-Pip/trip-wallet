import { describe, it, expect, beforeEach, vi } from 'vitest';

function setReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

const KOFI = 'https://ko-fi.com/example';

// donation.ts は twa.ts 経由で「この読み込みで TWA 起動を観測したか」を見る。
// twa.ts がモジュール内に状態を持つので、1 件 = 1 起動として読み直す。
async function load() {
  vi.resetModules();
  const donation = await import('./donation');
  const twa = await import('./twa');
  return { donation, twa };
}

describe('サポートセクションの表示条件', () => {
  beforeEach(() => {
    localStorage.clear();
    setReferrer('');
  });

  it('URL が空のあいだは描画しない', async () => {
    const { donation } = await load();
    expect(donation.shouldShowDonation('')).toBe(false);
  });

  it('URL があれば描画する', async () => {
    const { donation } = await load();
    expect(donation.shouldShowDonation(KOFI)).toBe(true);
  });

  // DONATION_URL が空のあいだは、この行は既定引数が通っていることしか見ない。
  // URL を入れた時点で、既定引数の配線を守るテストになる。
  it('既定では DONATION_URL を見る', async () => {
    const { donation } = await load();
    expect(donation.shouldShowDonation()).toBe(donation.DONATION_URL !== '');
  });

  it('TWA(Play 版)では URL があっても描画しない', async () => {
    const { donation, twa } = await load();
    setReferrer('android-app://io.github.unikpip.tripwallet');
    twa.markTwaLaunch();
    expect(donation.shouldShowDonation(KOFI)).toBe(false);
  });
});
