import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '../data/db';
import { addExpense } from '../data/expenseRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { HomeScreen } from './HomeScreen';

let trip: Trip;

beforeEach(async () => {
  await db.delete();
  await db.open();
  trip = await createTrip({
    name: '上海',
    currency: 'CNY',
    memberCount: 2,
    budgetJpy: 10000,
  });
  await addExpense({
    tripId: trip.id,
    date: '2026-09-12',
    amountMinor: 12000, // 120.00 元
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
    amountMinor: 10000, // 100.00 元
    scope: 'shared',
    category: 'transport',
    payment: 'mobile',
    memo: 'タクシー',
    rate: 23,
    rateSource: 'api',
    photoId: null,
  });
});

describe('HomeScreen', () => {
  it('サマリーを表示する', async () => {
    render(<HomeScreen trip={trip} />);

    expect(await screen.findByTestId('total-jpy')).toHaveTextContent('¥5,116');
    expect(screen.getByTestId('personal-jpy')).toHaveTextContent('¥2,816');
    expect(screen.getByTestId('shared-jpy')).toHaveTextContent('¥2,300');
    expect(screen.getByTestId('shared-per-person')).toHaveTextContent('¥1,150');
    expect(screen.getByTestId('remaining-jpy')).toHaveTextContent('¥4,884');
  });

  it('日付ごとに支出を並べる', async () => {
    render(<HomeScreen trip={trip} />);

    expect(await screen.findByText('9/12(土)')).toBeInTheDocument();
    expect(screen.getByText('9/11(金)')).toBeInTheDocument();
    expect(screen.getByText('小籠包')).toBeInTheDocument();
    expect(screen.getByText('120.00元 → ¥2,816')).toBeInTheDocument();
    expect(screen.getByText('100.00元 → ¥2,300')).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['9/12(土)', '9/11(金)']);
  });

  it('支出が無ければ案内を出す', async () => {
    const empty = await createTrip({ name: '香港', currency: 'HKD' });
    render(<HomeScreen trip={empty} />);

    expect(await screen.findByText('まだ支出がありません。右下の + から追加してください。')).toBeInTheDocument();
  });
});
