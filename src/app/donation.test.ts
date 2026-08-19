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

  it('既定では DONATION_URL を見る', () => {
    expect(shouldShowDonation()).toBe(DONATION_URL !== '');
  });

  // href に相対パスを入れると別タブで自サイトが開くだけになる。プロトコル込みかどうかを見張る。
  it('DONATION_URL は絶対 URL である', () => {
    if (DONATION_URL !== '') expect(DONATION_URL).toMatch(/^https:\/\//);
  });
});
