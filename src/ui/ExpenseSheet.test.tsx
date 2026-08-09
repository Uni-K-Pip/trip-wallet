import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { addExpense, listExpenses, updateExpense } from '../data/expenseRepo';
import { getPhoto, savePhoto } from '../data/photoRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { resolveRate } from '../rates/resolveRate';
import { ExpenseSheet } from './ExpenseSheet';

vi.mock('../rates/resolveRate', () => ({
  resolveRate: vi.fn(),
  prefetchTodayRate: vi.fn(),
}));

// addExpense/updateExpense は既定では実装をそのまま呼ぶ。個別テストで
// mockRejectedValueOnce を差し込んで「1 回だけ保存失敗」を再現するための部分モック。
vi.mock('../data/expenseRepo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/expenseRepo')>();
  return {
    ...actual,
    addExpense: vi.fn(actual.addExpense),
    updateExpense: vi.fn(actual.updateExpense),
  };
});

// compressImage は createImageBitmap/canvas に依存しており jsdom では動かないため、
// 写真アップロードを経由するテストではそのまま Blob を通すだけのモックに差し替える。
vi.mock('../media/compressImage', () => ({
  compressImage: vi.fn((blob: Blob) => Promise.resolve(blob)),
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

  it('写真を撮り直して保存すると、古い写真は db から消える', async () => {
    const oldPhotoId = await savePhoto(new Blob(['old'], { type: 'image/jpeg' }));
    const expense = await addExpense({
      tripId: trip.id,
      date: '2026-09-11',
      amountMinor: 500,
      scope: 'personal',
      category: 'food',
      payment: 'cash',
      memo: '',
      rate: 20,
      rateSource: 'api',
      photoId: oldPhotoId,
    });

    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} expense={expense} onClose={onClose} />);

    const newFile = new File(['new'], 'receipt.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/レシート写真/), newFile);
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = (await listExpenses(trip.id))[0];
    expect(saved.photoId).not.toBe(oldPhotoId);
    expect(saved.photoId).not.toBeNull();
    expect(await getPhoto(oldPhotoId)).toBeUndefined();
    expect(await getPhoto(saved.photoId as string)).toBeDefined();
  });

  it('保存に1回失敗して再試行しても、写真は二重保存されない', async () => {
    vi.mocked(resolveRate).mockResolvedValue({
      rate: 23.465,
      effectiveDate: '2026-09-11',
      source: 'api',
      stale: false,
    });
    vi.mocked(addExpense).mockRejectedValueOnce(new Error('一時的な保存失敗'));

    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} onClose={onClose} />);

    await screen.findByText(/23\.465/);
    await user.click(screen.getByRole('button', { name: '1' }));

    const file = new File(['photo'], 'receipt.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/レシート写真/), file);

    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('保存できませんでした')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(await db.photos.count()).toBe(1);
  });

  it('写真差し替え後に updateExpense が失敗すると、旧写真は残る(参照切れを防ぐ)', async () => {
    const oldPhotoId = await savePhoto(new Blob(['old'], { type: 'image/jpeg' }));
    const expense = await addExpense({
      tripId: trip.id,
      date: '2026-09-11',
      amountMinor: 500,
      scope: 'personal',
      category: 'food',
      payment: 'cash',
      memo: '',
      rate: 20,
      rateSource: 'api',
      photoId: oldPhotoId,
    });
    vi.mocked(updateExpense).mockRejectedValueOnce(new Error('一時的な保存失敗'));

    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} expense={expense} onClose={onClose} />);

    const newFile = new File(['new'], 'receipt.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/レシート写真/), newFile);
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存できませんでした')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // 支出レコードはまだ旧 photoId を参照したまま。ここで旧写真の Blob が
    // 消えていたら、支出から辿れる写真が無くなる(参照切れ)。
    expect(await getPhoto(oldPhotoId)).toBeDefined();
  });

  it('写真差し替え後に updateExpense が1回失敗しても、再試行して成功すれば旧写真は消える', async () => {
    const oldPhotoId = await savePhoto(new Blob(['old'], { type: 'image/jpeg' }));
    const expense = await addExpense({
      tripId: trip.id,
      date: '2026-09-11',
      amountMinor: 500,
      scope: 'personal',
      category: 'food',
      payment: 'cash',
      memo: '',
      rate: 20,
      rateSource: 'api',
      photoId: oldPhotoId,
    });
    vi.mocked(updateExpense).mockRejectedValueOnce(new Error('一時的な保存失敗'));

    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} expense={expense} onClose={onClose} />);

    const newFile = new File(['new'], 'receipt.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/レシート写真/), newFile);
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存できませんでした')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // 2 回目は updateExpense のモックが元の実装に戻っているので成功する。
    // ここで photoId state は 1 回目の savePhoto 成功時点で新 id に進んでいるため、
    // 「消すべき旧 id」を取り違えずに覚えていられるかがこのテストの本題。
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const saved = (await listExpenses(trip.id))[0];
    expect(saved.photoId).not.toBe(oldPhotoId);
    expect(saved.photoId).not.toBeNull();
    expect(await getPhoto(oldPhotoId)).toBeUndefined();
    expect(await getPhoto(saved.photoId as string)).toBeDefined();
  });

  it('保存が失敗したあと再試行せず閉じると、その回の新写真は消え、旧写真は残る', async () => {
    const oldPhotoId = await savePhoto(new Blob(['old'], { type: 'image/jpeg' }));
    const expense = await addExpense({
      tripId: trip.id,
      date: '2026-09-11',
      amountMinor: 500,
      scope: 'personal',
      category: 'food',
      payment: 'cash',
      memo: '',
      rate: 20,
      rateSource: 'api',
      photoId: oldPhotoId,
    });
    vi.mocked(updateExpense).mockRejectedValueOnce(new Error('一時的な保存失敗'));

    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} expense={expense} onClose={onClose} />);

    const newFile = new File(['new'], 'receipt.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/レシート写真/), newFile);
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存できませんでした')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    const photosAfterFailure = await db.photos.toArray();
    expect(photosAfterFailure).toHaveLength(2);
    const newPhotoId = photosAfterFailure.find((p) => p.id !== oldPhotoId)?.id as string;
    expect(newPhotoId).toBeDefined();

    // 再試行せずにキャンセルで離脱する。支出レコードは旧 photoId を参照したまま。
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(await getPhoto(oldPhotoId)).toBeDefined();
    expect(await getPhoto(newPhotoId)).toBeUndefined();
  });

  /**
   * 既存写真つきの支出を開いて写真を差し替え、「保存」を押した直後の
   * 「savePhoto は完了して photoId state は新写真を指しているが、
   * updateExpense はまだ飛行中で支出レコードは旧 photoId のまま」という窓を作る。
   * この窓で閉じる操作を踏むのが、写真を失う一番危ないタイミング。
   * release() を呼ぶと updateExpense が本来の実装で完了する。
   */
  async function startSaveWithPendingUpdate() {
    const oldPhotoId = await savePhoto(new Blob(['old'], { type: 'image/jpeg' }));
    const expense = await addExpense({
      tripId: trip.id,
      date: '2026-09-11',
      amountMinor: 500,
      scope: 'personal',
      category: 'food',
      payment: 'cash',
      memo: '',
      rate: 20,
      rateSource: 'api',
      photoId: oldPhotoId,
    });

    // updateExpense の解決をテスト側で握る。release() を呼ぶまで pending のまま。
    const actual =
      await vi.importActual<typeof import('../data/expenseRepo')>('../data/expenseRepo');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(updateExpense).mockImplementationOnce(async (id, patch) => {
      await gate;
      await actual.updateExpense(id, patch);
    });

    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} expense={expense} onClose={onClose} />);

    const newFile = new File(['new'], 'receipt.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/レシート写真/), newFile);
    await user.click(screen.getByRole('button', { name: '保存' }));

    // 新写真が db に入る(= savePhoto 完了)まで待って、飛行中の窓に入ったことを確かめる
    await waitFor(async () => {
      expect(await db.photos.count()).toBe(2);
    });
    const newPhotoId = (await db.photos.toArray()).find((p) => p.id !== oldPhotoId)?.id as string;
    expect(newPhotoId).toBeDefined();

    return { user, onClose, oldPhotoId, newPhotoId, release };
  }

  it('保存の実行中は背景・✕・キャンセルのどれでも閉じず、commit 待ちの写真も消えない', async () => {
    const { user, onClose, oldPhotoId, newPhotoId, release } = await startSaveWithPendingUpdate();

    // Sheet の背景(role="presentation" の div)は dialog の親要素
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.click(backdrop);
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onClose).not.toHaveBeenCalled();
    // 支出レコードにまだ反映されていない新写真も、まだ現役の旧写真も、この時点で消してはいけない
    expect(await getPhoto(newPhotoId)).toBeDefined();
    expect(await getPhoto(oldPhotoId)).toBeDefined();

    release();
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    // 保存が確定したので、支出が参照する新写真は残り、旧写真だけが消える
    const saved = (await listExpenses(trip.id))[0];
    expect(saved.photoId).toBe(newPhotoId);
    expect(await getPhoto(newPhotoId)).toBeDefined();
    expect(await getPhoto(oldPhotoId)).toBeUndefined();
  });

  it('保存の実行中に閉じる操作をしても onClose は保存完了時の 1 回だけ呼ばれる', async () => {
    const { user, onClose, release } = await startSaveWithPendingUpdate();

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('保存しました');
  });
});
