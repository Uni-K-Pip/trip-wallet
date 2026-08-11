import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { addExpense } from '../data/expenseRepo';
import { createTrip, listTrips, getTrip } from '../data/tripRepo';
import { TripForm } from './TripForm';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('TripForm', () => {
  it('新規作成時の初期通貨は米ドル', () => {
    render(<TripForm onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText('通貨')).toHaveValue('USD');
  });

  it('旅行名の入力例は NY 2026-09', () => {
    render(<TripForm onDone={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText('旅行名')).toHaveAttribute('placeholder', 'NY 2026-09');
  });

  it('入力した内容で旅行を作る', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('旅行名'), '上海 2026-09');
    await user.selectOptions(screen.getByLabelText('通貨'), 'CNY');
    await user.clear(screen.getByLabelText('人数'));
    await user.type(screen.getByLabelText('人数'), '2');
    await user.type(screen.getByLabelText('個別予算(円)'), '100000');
    await user.type(screen.getByLabelText('共有予算(円・自分の負担分)'), '30000');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const trips = await listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].name).toBe('上海 2026-09');
    expect(trips[0].currency).toBe('CNY');
    expect(trips[0].currencyDecimals).toBe(2);
    expect(trips[0].memberCount).toBe(2);
    expect(trips[0].personalBudgetJpy).toBe(100000);
    expect(trips[0].sharedBudgetJpy).toBe(30000);
  });

  it('予算に数値として解釈できない文字列を入れたら null になる', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('旅行名'), 'NY 2026-09');
    await user.type(screen.getByLabelText('個別予算(円)'), 'abc');
    await user.type(screen.getByLabelText('共有予算(円・自分の負担分)'), '1.2.3');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const trips = await listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].personalBudgetJpy).toBeNull();
    expect(trips[0].sharedBudgetJpy).toBeNull();
  });

  it('片方だけ予算を入れても保存できる', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('旅行名'), 'NY 2026-09');
    await user.type(screen.getByLabelText('共有予算(円・自分の負担分)'), '30000');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const trips = await listTrips();
    expect(trips[0].personalBudgetJpy).toBeNull();
    expect(trips[0].sharedBudgetJpy).toBe(30000);
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

  it('支出が 1 件以上ある旅行を編集すると通貨 select が disabled になり説明文が出る', async () => {
    const trip = await createTrip({ name: '上海', currency: 'CNY' });
    await addExpense({
      tripId: trip.id,
      date: '2026-09-12',
      amountMinor: 12000,
      scope: 'personal',
      category: 'food',
      payment: 'cash',
      memo: '小籠包',
      rate: 23.465,
      rateSource: 'api',
      photoId: null,
    });
    render(<TripForm trip={trip} onDone={() => {}} onCancel={() => {}} />);

    // useLiveQuery は初回レンダーで既定値 0 を返すため、disabled になるまで待つ
    await waitFor(() => expect(screen.getByLabelText('通貨')).toBeDisabled());
    expect(screen.getByText('支出があるため通貨は変更できません。')).toBeInTheDocument();
  });

  it('支出が 0 件の旅行を編集しても通貨 select は disabled にならない', async () => {
    const trip = await createTrip({ name: '上海', currency: 'CNY' });
    render(<TripForm trip={trip} onDone={() => {}} onCancel={() => {}} />);

    // useLiveQuery の解決を待ってから確認する
    await waitFor(() => expect(screen.getByLabelText('通貨')).not.toBeDisabled());
    expect(screen.queryByText('支出があるため通貨は変更できません。')).not.toBeInTheDocument();
  });
});
