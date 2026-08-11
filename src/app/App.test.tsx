import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { createTrip } from '../data/tripRepo';
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
  await createTrip({ name: '上海 2026-09', currency: 'CNY' });
  const ny = await createTrip({ name: 'NY 2026-09', currency: 'USD' });
  localStorage.setItem('trip-wallet:active-trip', ny.id);
}

describe('App のヘッダー', () => {
  it('旅行が 2 件以上ならヘッダーがボタンになる', async () => {
    await seedTwoTrips();
    render(<App />);

    const button = await screen.findByRole('button', { name: 'NY 2026-09' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('旅行が 1 件ならヘッダーはボタンにならない', async () => {
    await createTrip({ name: 'NY 2026-09', currency: 'USD' });
    render(<App />);

    // ▾ の span は aria-hidden なので、ボタンでもアクセシブル名は旅行名だけになる。
    // 見出しの中に button があるかどうかで判定する。
    const heading = await screen.findByRole('heading', { level: 1, name: 'NY 2026-09' });
    expect(heading.querySelector('button')).toBeNull();
  });

  it('シートで選び直して決定すると表示中の旅行が変わる', async () => {
    await seedTwoTrips();
    const user = userEvent.setup();
    render(<App />);

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
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'NY 2026-09' }));
    await user.click(await screen.findByRole('option', { name: '上海 2026-09' }));
    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.getByRole('heading', { level: 1, name: 'NY 2026-09' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('設定タブではヘッダーをボタンにしない', async () => {
    await seedTwoTrips();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('button', { name: 'NY 2026-09' });
    await user.click(screen.getByRole('button', { name: '⚙️ 設定' }));

    const heading = screen.getByRole('heading', { level: 1, name: 'NY 2026-09' });
    expect(heading.querySelector('button')).toBeNull();
  });
});
