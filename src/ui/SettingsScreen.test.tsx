import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
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
      version: 1,
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
