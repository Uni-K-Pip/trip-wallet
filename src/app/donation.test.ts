import { describe, it, expect } from 'vitest';
import { DONATION_URL, shouldShowDonation } from './donation';

const KOFI = 'https://ko-fi.com/example';

describe('サポートセクションの表示条件', () => {
  it('URL が空のあいだは描画しない', () => {
    expect(shouldShowDonation('')).toBe(false);
  });

  it('URL があれば描画する', () => {
    expect(shouldShowDonation(KOFI)).toBe(true);
  });

  // DONATION_URL が空のあいだは、この行は既定引数が通っていることしか見ない。
  // URL を入れた時点で、既定引数の配線を守るテストになる。
  it('既定では DONATION_URL を見る', () => {
    expect(shouldShowDonation()).toBe(DONATION_URL !== '');
  });
});
