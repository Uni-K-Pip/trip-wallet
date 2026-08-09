import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { createTrip, listTrips, getTrip } from '../data/tripRepo';
import { TripForm } from './TripForm';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('TripForm', () => {
  it('入力した内容で旅行を作る', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('旅行名'), '上海 2026-09');
    await user.selectOptions(screen.getByLabelText('通貨'), 'CNY');
    await user.clear(screen.getByLabelText('人数'));
    await user.type(screen.getByLabelText('人数'), '2');
    await user.type(screen.getByLabelText('予算(円)'), '100000');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const trips = await listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].name).toBe('上海 2026-09');
    expect(trips[0].currency).toBe('CNY');
    expect(trips[0].currencyDecimals).toBe(2);
    expect(trips[0].memberCount).toBe(2);
    expect(trips[0].budgetJpy).toBe(100000);
  });

  it('予算に数値として解釈できない文字列を入れたら budgetJpy は null になる', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('旅行名'), '上海 2026-09');
    await user.type(screen.getByLabelText('予算(円)'), 'abc');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const trips = await listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].budgetJpy).toBeNull();
  });

  it('旅行名が空なら保存しない', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('旅行名を入力してください')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(await listTrips()).toEqual([]);
  });

  it('既存の旅行を編集する', async () => {
    const trip = await createTrip({ name: '上海', currency: 'CNY' });
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm trip={trip} onDone={onDone} onCancel={() => {}} />);

    const name = screen.getByLabelText('旅行名');
    await user.clear(name);
    await user.type(name, '上海 2026 秋');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((await getTrip(trip.id))?.name).toBe('上海 2026 秋');
    expect(await listTrips()).toHaveLength(1);
  });
});
