import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { addExpense, deleteExpense, listExpenses } from '../data/expenseRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { renderWithLang } from '../test/renderWithLang';
import { HomeScreen } from './HomeScreen';

// deleteExpense は既定では実装をそのまま呼ぶ。失敗時のふるまいを検証するテストで
// mockRejectedValueOnce を差し込むための部分モック。
vi.mock('../data/expenseRepo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/expenseRepo')>();
  return {
    ...actual,
    deleteExpense: vi.fn(actual.deleteExpense),
  };
});

let trip: Trip;

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.mocked(deleteExpense).mockClear();
  trip = await createTrip({
    name: '上海',
    currency: 'CNY',
    homeCurrency: 'JPY',
    memberCount: 2,
    personalBudgetHome: 10000,
    sharedBudgetHome: 3000,
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
    renderWithLang(<HomeScreen trip={trip} />);

    expect(await screen.findByTestId('total-home')).toHaveTextContent('¥5,116');
    expect(screen.getByTestId('personal-home')).toHaveTextContent('¥2,816');
    expect(screen.getByTestId('shared-home')).toHaveTextContent('¥2,300');
    expect(screen.getByTestId('shared-per-person')).toHaveTextContent('¥1,150');
    expect(screen.getByTestId('personal-remaining-home')).toHaveTextContent('¥7,184');
    expect(screen.getByTestId('shared-remaining-home')).toHaveTextContent('¥1,850');
  });

  it('設定されている側の予算バーだけを出す', async () => {
    const personalOnly = await createTrip({
      name: 'NY',
      currency: 'USD',
      homeCurrency: 'JPY',
      personalBudgetHome: 5000,
    });
    renderWithLang(<HomeScreen trip={personalOnly} />);

    expect(await screen.findByTestId('personal-remaining-home')).toBeInTheDocument();
    expect(screen.queryByTestId('shared-remaining-home')).not.toBeInTheDocument();
  });

  it('予算が両方とも未設定ならバーを出さない', async () => {
    const noBudget = await createTrip({ name: '香港', currency: 'HKD', homeCurrency: 'JPY' });
    renderWithLang(<HomeScreen trip={noBudget} />);

    await screen.findByText('まだ支出がありません。右下の + から追加してください。');
    expect(screen.queryByTestId('personal-remaining-home')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shared-remaining-home')).not.toBeInTheDocument();
  });

  it('日付ごとに支出を並べる', async () => {
    renderWithLang(<HomeScreen trip={trip} />);

    expect(await screen.findByText('9/12(土)')).toBeInTheDocument();
    expect(screen.getByText('9/11(金)')).toBeInTheDocument();
    expect(screen.getByText('小籠包')).toBeInTheDocument();
    expect(screen.getByText('120.00元 → ¥2,816')).toBeInTheDocument();
    expect(screen.getByText('100.00元 → ¥2,300')).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['9/12(土)', '9/11(金)']);
  });

  it('支出が無ければ案内を出す', async () => {
    const empty = await createTrip({ name: '香港', currency: 'HKD', homeCurrency: 'JPY' });
    renderWithLang(<HomeScreen trip={empty} />);

    expect(await screen.findByText('まだ支出がありません。右下の + から追加してください。')).toBeInTheDocument();
  });

  it('シートを開いたまま別の支出の行が操作されると、新しい支出のデータで再表示される', async () => {
    renderWithLang(<HomeScreen trip={trip} />);

    // 小籠包(支出A)の編集シートを開く
    const rowA = (await screen.findByText('小籠包')).closest('button');
    expect(rowA).not.toBeNull();
    fireEvent.click(rowA!);
    expect(await screen.findByLabelText('メモ')).toHaveValue('小籠包');

    // シートを閉じないまま、背後にあるタクシー(支出B)の行を直接操作する。
    // 実ブラウザでは .sheet-backdrop (z-index: 20) がポインタ操作を遮るが、
    // キーボードの Tab フォーカス移動やスクリーンリーダーの読み上げ操作による
    // 決定操作はその遮蔽を経由しない。jsdom は実際の CSS レイアウト・重なり判定
    // (hit-testing)を行わないため、背後要素への fireEvent.click は、そうした
    // ポインタ以外の到達経路を模擬する手段として使える。
    const rowB = screen.getByText('タクシー').closest('button');
    expect(rowB).not.toBeNull();
    fireEvent.click(rowB!);

    // key の付け替えにより ExpenseSheet が再マウントされ、支出Bの内容が
    // 表示されるべき(key が無いと、支出Aのマウント時 useState 初期値が
    // 残ったままになる)
    expect(await screen.findByLabelText('メモ')).toHaveValue('タクシー');
  });

  it('削除に失敗すると行は残ったまま失敗メッセージを出す', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteExpense).mockRejectedValueOnce(new Error('一時的な削除失敗'));
    const user = userEvent.setup();
    renderWithLang(<HomeScreen trip={trip} />);

    const deleteButtons = await screen.findAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);

    expect(await screen.findByText('削除できませんでした')).toBeInTheDocument();
    expect(await listExpenses(trip.id)).toHaveLength(2);
  });

  it('削除に成功すると完了メッセージを出す', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderWithLang(<HomeScreen trip={trip} />);

    const deleteButtons = await screen.findAllByRole('button', { name: '削除' });
    await user.click(deleteButtons[0]);

    expect(await screen.findByText('削除しました')).toBeInTheDocument();
    await waitFor(async () => expect(await listExpenses(trip.id)).toHaveLength(1));
  });
});
