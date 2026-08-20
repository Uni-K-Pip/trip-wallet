import { describe, it, expect, vi } from 'vitest';
import { ANALYTICS_CODE, countLaunch, countDonationClick } from './analytics';

// 実際の ANALYTICS_CODE(空文字)と紛れないよう、テストでは別のコードを注入する
const CODE = 'testcode';

// frankfurter.test.ts と同じ流儀で、Response の実体は作らず必要な形だけ返す
function fetchSpy() {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200 }) as Response);
}

// 送信オプションは 2 種類とも同じ。テストの期待値もここから使う。
// 型注釈は必須。無いと mode が string に推論され、toHaveBeenCalledWith が
// fetch の引数型と突き合わせるときに RequestMode へ代入できず型エラーになる。
const INIT: RequestInit = {
  mode: 'no-cors',
  cache: 'no-store',
  keepalive: true,
  referrerPolicy: 'no-referrer',
};

describe('計測ビーコン', () => {
  it('起動は p=/app&t=launch を送る', () => {
    const f = fetchSpy();
    countLaunch(f as unknown as typeof fetch, CODE);

    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith('https://testcode.goatcounter.com/count?p=%2Fapp&t=launch', INIT);
  });

  it('寄付タップは p=donate-click&e=1 を送る', () => {
    const f = fetchSpy();
    countDonationClick(f as unknown as typeof fetch, CODE);

    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(
      'https://testcode.goatcounter.com/count?p=donate-click&e=1',
      INIT,
    );
  });

  // 送らないと決めたものが後から紛れ込まないよう、URL の形で見張る
  it('リファラ(r)と画面サイズ(s)は送らない', () => {
    const f = fetchSpy();
    countLaunch(f as unknown as typeof fetch, CODE);
    countDonationClick(f as unknown as typeof fetch, CODE);

    expect(f).toHaveBeenCalledTimes(2);
    for (const [url] of f.mock.calls) {
      expect(url).not.toMatch(/[?&]r=/);
      expect(url).not.toMatch(/[?&]s=/);
    }
  });

  it('サイトコードが空のあいだは一切送信しない', () => {
    const f = fetchSpy();
    countLaunch(f as unknown as typeof fetch, '');
    countDonationClick(f as unknown as typeof fetch, '');

    expect(f).not.toHaveBeenCalled();
  });

  it('送信が失敗しても例外が外に出ない', () => {
    const f = vi.fn(async () => {
      throw new Error('オフライン');
    });

    expect(() => countLaunch(f as unknown as typeof fetch, CODE)).not.toThrow();
    expect(() => countDonationClick(f as unknown as typeof fetch, CODE)).not.toThrow();
  });

  it('fetch が同期的に投げても例外が外に出ない', () => {
    const f = vi.fn(() => {
      throw new Error('拡張機能に差し替えられた fetch');
    });

    expect(() => countLaunch(f as unknown as typeof fetch, CODE)).not.toThrow();
    expect(() => countDonationClick(f as unknown as typeof fetch, CODE)).not.toThrow();
  });

  it('既定では ANALYTICS_CODE を見る', () => {
    const f = fetchSpy();
    countLaunch(f as unknown as typeof fetch);

    expect(f.mock.calls.length).toBe(ANALYTICS_CODE === '' ? 0 : 1);
  });

  // コード欄に URL を丸ごと貼ると https://https://... の壊れた URL になる。形を見張る。
  it('ANALYTICS_CODE はサブドメインとして使える形である', () => {
    if (ANALYTICS_CODE !== '') expect(ANALYTICS_CODE).toMatch(/^[a-z0-9-]+$/);
  });
});
