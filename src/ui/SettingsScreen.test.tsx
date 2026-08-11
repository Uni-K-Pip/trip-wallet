import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { createTrip } from '../data/tripRepo';
import { exportBackup } from '../data/backup';
import { SettingsScreen } from './SettingsScreen';

// exportBackup だけモックする。serializeBackup / parseBackup / importBackup /
// backupFileName は実装のまま使う。
vi.mock('../data/backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/backup')>();
  return {
    ...actual,
    exportBackup: vi.fn(),
  };
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.mocked(exportBackup).mockReset();
  // jsdom は URL.createObjectURL / revokeObjectURL を実装していない
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
});

describe('SettingsScreen のエクスポート', () => {
  it('exportBackup が失敗したら失敗メッセージを出し、成功メッセージは出さない', async () => {
    vi.mocked(exportBackup).mockRejectedValue(new Error('メモリ不足'));
    const user = userEvent.setup();
    render(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'バックアップを書き出す' }));

    expect(await screen.findByText('書き出せませんでした')).toBeInTheDocument();
    expect(screen.queryByText('バックアップを書き出しました')).not.toBeInTheDocument();
  });

  it('正常時は「バックアップを書き出しました」が出る', async () => {
    vi.mocked(exportBackup).mockResolvedValue({
      format: 'trip-wallet-backup',
      version: 3,
      exportedAt: 0,
      trips: [],
      expenses: [],
      photos: [],
    });
    const user = userEvent.setup();
    render(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'バックアップを書き出す' }));

    expect(await screen.findByText('バックアップを書き出しました')).toBeInTheDocument();
  });
});

describe('SettingsScreen のインポート', () => {
  it('壊れた JSON を取り込むとエラー文言が出る', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

    const file = new File(['not json'], 'broken.json', { type: 'application/json' });
    const input = screen.getByLabelText('取り込む');
    await user.upload(input, file);

    expect(await screen.findByText('JSON として読み込めませんでした')).toBeInTheDocument();
  });
});

describe('SettingsScreen の旅行一覧', () => {
  it('旅行メタに個別予算と共有予算を出す', async () => {
    const trip = await createTrip({
      name: '上海',
      currency: 'CNY',
      homeCurrency: 'JPY',
      personalBudgetHome: 50000,
      sharedBudgetHome: 30000,
    });
    render(<SettingsScreen trips={[trip]} activeTrip={trip} onSelectTrip={() => {}} />);

    expect(screen.getByText(/個別 ¥50,000 \/ 共有 ¥30,000/)).toBeInTheDocument();
  });

  it('片方だけ設定されていればその側だけ出す', async () => {
    const trip = await createTrip({
      name: 'NY',
      currency: 'USD',
      homeCurrency: 'JPY',
      sharedBudgetHome: 30000,
    });
    render(<SettingsScreen trips={[trip]} activeTrip={trip} onSelectTrip={() => {}} />);

    expect(screen.getByText(/\/ 共有 ¥30,000/)).toBeInTheDocument();
    expect(screen.queryByText(/個別 ¥/)).not.toBeInTheDocument();
  });
});
