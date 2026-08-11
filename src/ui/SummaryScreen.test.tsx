import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { addExpense } from '../data/expenseRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { renderWithLang } from '../test/renderWithLang';
import { SummaryScreen } from './SummaryScreen';

let trip: Trip;

beforeEach(async () => {
  await db.delete();
  await db.open();
  trip = await createTrip({ name: '上海', currency: 'CNY', homeCurrency: 'JPY', memberCount: 2 });
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
    renderWithLang(<SummaryScreen trip={trip} />);

    expect(await screen.findByTestId('summary-total')).toHaveTextContent('¥5,116');
    expect(screen.getByTestId('summary-personal')).toHaveTextContent('¥2,816');
    expect(screen.getByTestId('summary-shared')).toHaveTextContent('¥2,300');
    expect(screen.getByTestId('summary-share-note')).toHaveTextContent('自分の負担 ¥1,150(2人)');
    expect(screen.getByTestId('summary-mine')).toHaveTextContent('¥3,966');
  });

  it('初期表示は自己負担で、カテゴリ別を多い順に並べる', async () => {
    renderWithLang(<SummaryScreen trip={trip} />);

    const rows = await screen.findAllByTestId('cat-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('食事');
    expect(rows[0]).toHaveTextContent('¥2,816');
    expect(rows[0]).toHaveTextContent('71%');
    expect(rows[1]).toHaveTextContent('交通');
    expect(rows[1]).toHaveTextContent('¥1,150');
    expect(rows[1]).toHaveTextContent('29%');
    expect(screen.getByTestId('category-head-note')).toHaveTextContent('自己負担 ¥3,966');
    expect(screen.getByTestId('daily-head-note')).toHaveTextContent('自己負担');
  });

  it('日別推移を古い順に並べ、日付と金額を読み上げられる', async () => {
    renderWithLang(<SummaryScreen trip={trip} />);

    const cols = await screen.findAllByTestId('day-col');
    expect(cols.map((c) => c.getAttribute('aria-label'))).toEqual([
      '9/11(金) ¥1,150',
      '9/12(土) ¥2,816',
    ]);
  });

  it('共有に切り替えると共有だけの図になる', async () => {
    renderWithLang(<SummaryScreen trip={trip} />);
    await screen.findAllByTestId('cat-row');

    await userEvent.click(screen.getByRole('button', { name: '共有' }));

    const rows = screen.getAllByTestId('cat-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('交通');
    expect(rows[0]).toHaveTextContent('¥2,300');
    expect(screen.getByTestId('category-head-note')).toHaveTextContent('共有 ¥2,300');
    expect(screen.getAllByTestId('day-col')).toHaveLength(1);
  });

  it('個別に切り替えると個別だけの図になる', async () => {
    renderWithLang(<SummaryScreen trip={trip} />);
    await screen.findAllByTestId('cat-row');

    await userEvent.click(screen.getByRole('button', { name: '個別' }));

    const rows = screen.getAllByTestId('cat-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('食事');
    expect(rows[0]).toHaveTextContent('¥2,816');
    expect(screen.getByTestId('category-head-note')).toHaveTextContent('個別 ¥2,816');
  });

  it('切り替えても合計カードは変わらない', async () => {
    renderWithLang(<SummaryScreen trip={trip} />);
    expect(await screen.findByTestId('summary-total')).toHaveTextContent('¥5,116');

    await userEvent.click(screen.getByRole('button', { name: '個別' }));

    expect(screen.getByTestId('summary-total')).toHaveTextContent('¥5,116');
    expect(screen.getByTestId('summary-mine')).toHaveTextContent('¥3,966');
  });

  it('選んだスコープに支出が無ければその旨を出す', async () => {
    const solo = await createTrip({ name: '香港', currency: 'HKD', homeCurrency: 'JPY' });
    await addExpense({
      tripId: solo.id,
      date: '2026-09-12',
      amountMinor: 10000,
      scope: 'personal',
      category: 'food',
      payment: 'cash',
      memo: '',
      rate: 20,
      rateSource: 'api',
      photoId: null,
    });
    renderWithLang(<SummaryScreen trip={solo} />);
    await screen.findAllByTestId('cat-row');

    await userEvent.click(screen.getByRole('button', { name: '共有' }));

    expect(screen.getByText('共有の支出はまだありません。')).toBeInTheDocument();
    expect(screen.queryAllByTestId('cat-row')).toHaveLength(0);
  });

  it('支出が無ければ案内を出す', async () => {
    const empty = await createTrip({ name: '台北', currency: 'USD', homeCurrency: 'JPY' });
    renderWithLang(<SummaryScreen trip={empty} />);

    expect(await screen.findByText('集計する支出がまだありません。')).toBeInTheDocument();
  });
});
