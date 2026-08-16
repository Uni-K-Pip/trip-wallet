import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { createTrip } from '../data/tripRepo';
import { renderWithLang } from '../test/renderWithLang';
import { App } from './App';

// vite-plugin-pwa の仮想モジュールは disable 時も Node から読めない id を返すため、
// Vitest ではモジュールごと差し替える。更新通知はこのテストの対象外。
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }),
}));

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
});

/**
 * 旅行を 2 件作り、NY をアクティブにする。
 * どちらがアクティブかを createdAt の並びに頼ると不安定なので localStorage で固定する。
 */
async function seedTwoTrips(): Promise<void> {
  await createTrip({ name: '上海 2026-09', currency: 'CNY', homeCurrency: 'JPY' });
  const ny = await createTrip({ name: 'NY 2026-09', currency: 'USD', homeCurrency: 'JPY' });
  localStorage.setItem('trip-wallet:active-trip', ny.id);
}

describe('App のヘッダー', () => {
  it('旅行が 2 件以上ならヘッダーがボタンになる', async () => {
    await seedTwoTrips();
    renderWithLang(<App />);

    const button = await screen.findByRole('button', { name: 'NY 2026-09' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('旅行が 1 件ならヘッダーはボタンにならない', async () => {
    await createTrip({ name: 'NY 2026-09', currency: 'USD', homeCurrency: 'JPY' });
    renderWithLang(<App />);

    // ▾ の span は aria-hidden なので、ボタンでもアクセシブル名は旅行名だけになる。
    // 見出しの中に button があるかどうかで判定する。
    const heading = await screen.findByRole('heading', { level: 1, name: 'NY 2026-09' });
    expect(heading.querySelector('button')).toBeNull();
  });

  it('シートで選び直して決定すると表示中の旅行が変わる', async () => {
    await seedTwoTrips();
    const user = userEvent.setup();
    renderWithLang(<App />);

    await user.click(await screen.findByRole('button', { name: 'NY 2026-09' }));
    await user.click(await screen.findByRole('option', { name: '上海 2026-09' }));
    await user.click(screen.getByRole('button', { name: '決定' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '上海 2026-09' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('✕ で閉じると旅行は変わらない', async () => {
    await seedTwoTrips();
    const user = userEvent.setup();
    renderWithLang(<App />);

    await user.click(await screen.findByRole('button', { name: 'NY 2026-09' }));
    await user.click(await screen.findByRole('option', { name: '上海 2026-09' }));
    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.getByRole('heading', { level: 1, name: 'NY 2026-09' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('設定タブではヘッダーをボタンにしない', async () => {
    await seedTwoTrips();
    const user = userEvent.setup();
    renderWithLang(<App />);

    await screen.findByRole('button', { name: 'NY 2026-09' });
    await user.click(screen.getByRole('button', { name: '⚙️ 設定' }));

    const heading = screen.getByRole('heading', { level: 1, name: 'NY 2026-09' });
    expect(heading.querySelector('button')).toBeNull();
  });
});

describe('App の多言語表示', () => {
  it('英語ならタブが英語で出る', async () => {
    renderWithLang(<App />, 'en');
    expect(await screen.findByRole('button', { name: /Summary/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Settings/ })).toBeInTheDocument();
  });
});

describe('App のエクスポート促しバナー', () => {
  async function seedEndedTrip(): Promise<void> {
    const trip = await createTrip({
      name: '上海 2026-08',
      currency: 'CNY',
      homeCurrency: 'JPY',
      startDate: '2026-08-01',
      endDate: '2026-08-05',
    });
    localStorage.setItem('trip-wallet:active-trip', trip.id);
  }

  it('ホームタブでは設定へ誘導する', async () => {
    await seedEndedTrip();
    renderWithLang(<App />);

    expect(
      await screen.findByText('旅行が終わりました。設定からデータを書き出しておきましょう。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '設定へ' })).toBeInTheDocument();
  });

  it('設定タブでは文言を変えて「設定へ」を出さない', async () => {
    await seedEndedTrip();
    const user = userEvent.setup();
    renderWithLang(<App />);
    await screen.findByText('旅行が終わりました。設定からデータを書き出しておきましょう。');

    await user.click(screen.getByRole('button', { name: '⚙️ 設定' }));

    expect(
      screen.getByText(
        '旅行が終わりました。下の「バックアップを書き出す」からデータを書き出しておきましょう。',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '設定へ' })).not.toBeInTheDocument();
  });
});
