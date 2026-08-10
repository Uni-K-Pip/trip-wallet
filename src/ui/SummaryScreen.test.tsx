import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '../data/db';
import { addExpense } from '../data/expenseRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { SummaryScreen } from './SummaryScreen';

let trip: Trip;

beforeEach(async () => {
  await db.delete();
  await db.open();
  trip = await createTrip({ name: '上海', currency: 'CNY', memberCount: 2 });
  await addExpense({
    tripId: trip.id,
    date: '2026-09-12',
    amountMinor: 12000, // 120.00 元 × 23.465 = ¥2,816
    scope: 'personal',
    category: 'food',
    payment: 'cash',
    memo: '小籠包',
    rate: 23.465,
    rateSource: 'api',
    photoId: null,
  });
  await addExpense({
    tripId: trip.id,
    date: '2026-09-11',
    amountMinor: 10000, // 100.00 元 × 23 = ¥2,300
    scope: 'shared',
    category: 'transport',
    payment: 'mobile',
    memo: 'タクシー',
    rate: 23,
    rateSource: 'api',
    photoId: null,
  });
});

describe('SummaryScreen', () => {
  it('個別・共有・人数割りを表示する', async () => {
    render(<SummaryScreen trip={trip} />);

    expect(await screen.findByTestId('summary-total')).toHaveTextContent('¥5,116');
    expect(screen.getByTestId('summary-personal')).toHaveTextContent('¥2,816');
    expect(screen.getByTestId('summary-shared')).toHaveTextContent('¥2,300');
    expect(screen.getByTestId('summary-share-note')).toHaveTextContent('自分の負担 ¥1,150(2人)');
    expect(screen.getByTestId('summary-mine')).toHaveTextContent('¥3,966');
  });

  it('カテゴリ別を金額の多い順に並べる', async () => {
    render(<SummaryScreen trip={trip} />);

    const rows = await screen.findAllByTestId('cat-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('食事');
    expect(rows[0]).toHaveTextContent('¥2,816');
    expect(rows[0]).toHaveTextContent('55%');
    expect(rows[1]).toHaveTextContent('交通');
    expect(rows[1]).toHaveTextContent('¥2,300');
    expect(rows[1]).toHaveTextContent('45%');
  });

  it('日別推移を古い順に並べる', async () => {
    render(<SummaryScreen trip={trip} />);

    const rows = await screen.findAllByTestId('day-row');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('9/11(金)'),
      expect.stringContaining('9/12(土)'),
    ]);
    expect(rows[0]).toHaveTextContent('¥2,300');
    expect(rows[1]).toHaveTextContent('¥2,816');
  });

  it('支出が無ければ案内を出す', async () => {
    const empty = await createTrip({ name: '香港', currency: 'HKD' });
    render(<SummaryScreen trip={empty} />);

    expect(await screen.findByText('集計する支出がまだありません。')).toBeInTheDocument();
  });
});
