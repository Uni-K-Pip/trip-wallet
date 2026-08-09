import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { listExpenses } from '../data/expenseRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { resolveRate } from '../rates/resolveRate';
import { ExpenseSheet } from './ExpenseSheet';

vi.mock('../rates/resolveRate', () => ({
  resolveRate: vi.fn(),
  prefetchTodayRate: vi.fn(),
}));

let trip: Trip;

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
  vi.mocked(resolveRate).mockReset();
  trip = await createTrip({ name: '上海', currency: 'CNY', memberCount: 2 });
});

describe('ExpenseSheet', () => {
  it('金額とカテゴリを選んで保存すると、レートを焼き付けた支出ができる', async () => {
    vi.mocked(resolveRate).mockResolvedValue({
      rate: 23.465,
      effectiveDate: '2026-09-11',
      source: 'api',
      stale: false,
    });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} onClose={onClose} />);

    await screen.findByText(/23\.465/);
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '0' }));

    expect(screen.getByTestId('jpy-preview')).toHaveTextContent('¥2,816');

    await user.click(screen.getByRole('button', { name: /交通/ }));
    await user.click(screen.getByRole('button', { name: '共有' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await listExpenses(trip.id);
    expect(saved).toHaveLength(1);
    expect(saved[0].amountMinor).toBe(12000);
    expect(saved[0].rate).toBe(23.465);
    expect(saved[0].rateSource).toBe('api');
    expect(saved[0].category).toBe('transport');
    expect(saved[0].scope).toBe('shared');
    expect(saved[0].payment).toBe('cash');
  });

  it('レートを解決できないときは手動入力しないと保存できない', async () => {
    vi.mocked(resolveRate).mockResolvedValue(null);
    const user = userEvent.setup();
    render(<ExpenseSheet trip={trip} onClose={vi.fn()} />);

    expect(
      await screen.findByText('レートを取得できません。手動で入力してください'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('レートを入力してください')).toBeInTheDocument();
    expect(await listExpenses(trip.id)).toEqual([]);
  });

  it('レートを手動で上書きすると manual として保存される', async () => {
    vi.mocked(resolveRate).mockResolvedValue({
      rate: 23.465,
      effectiveDate: '2026-09-12',
      source: 'api',
      stale: false,
    });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} onClose={onClose} />);

    await screen.findByText(/23\.465/);
    await user.click(screen.getByRole('button', { name: 'レートを編集' }));
    const input = screen.getByLabelText('1元 = ? 円');
    await user.clear(input);
    await user.type(input, '24');
    await user.click(screen.getByRole('button', { name: 'レートを確定' }));

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await listExpenses(trip.id);
    expect(saved[0].rate).toBe(24);
    expect(saved[0].rateSource).toBe('manual');
    expect(saved[0].amountMinor).toBe(1000);
  });

  it('直近レートしか無いときは使用中の日付を知らせる', async () => {
    vi.mocked(resolveRate).mockResolvedValue({
      rate: 23.4,
      effectiveDate: '2026-09-10',
      source: 'cache',
      stale: true,
    });
    render(<ExpenseSheet trip={trip} onClose={vi.fn()} />);

    expect(await screen.findByText(/9\/10.*時点のレートを使用中/)).toBeInTheDocument();
  });
});
