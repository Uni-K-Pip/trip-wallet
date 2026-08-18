import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DONATION_URL, shouldShowDonation } from './donation';
import { isTwa } from './twa';

vi.mock('./twa', () => ({ isTwa: vi.fn() }));

const KOFI = 'https://ko-fi.com/example';

describe('サポートセクションの表示条件', () => {
  beforeEach(() => {
    vi.mocked(isTwa).mockReturnValue(false);
  });

  it('URL が空のあいだは描画しない', () => {
    expect(shouldShowDonation('')).toBe(false);
  });

  it('URL があれば描画する', () => {
    expect(shouldShowDonation(KOFI)).toBe(true);
  });

  it('TWA(Play 版)では URL があっても描画しない', () => {
    vi.mocked(isTwa).mockReturnValue(true);
    expect(shouldShowDonation(KOFI)).toBe(false);
  });

  it('既定では DONATION_URL を見る', () => {
    expect(shouldShowDonation()).toBe(DONATION_URL !== '');
  });
});
