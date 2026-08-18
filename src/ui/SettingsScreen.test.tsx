import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { createTrip } from '../data/tripRepo';
import { exportBackup } from '../data/backup';
import { shouldShowDonation } from '../app/donation';
import { renderWithLang } from '../test/renderWithLang';
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

vi.mock('../app/donation', () => ({
  DONATION_URL: 'https://ko-fi.com/example',
  shouldShowDonation: vi.fn(),
}));

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
  vi.mocked(exportBackup).mockReset();
  // jsdom は URL.createObjectURL / revokeObjectURL を実装していない
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
  vi.mocked(shouldShowDonation).mockReturnValue(false);
});

describe('SettingsScreen のエクスポート', () => {
  it('exportBackup が失敗したら失敗メッセージを出し、成功メッセージは出さない', async () => {
    vi.mocked(exportBackup).mockRejectedValue(new Error('メモリ不足'));
    const user = userEvent.setup();
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

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
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'バックアップを書き出す' }));

    expect(await screen.findByText('バックアップを書き出しました')).toBeInTheDocument();
  });
});

describe('SettingsScreen のインポート', () => {
  it('壊れた JSON を取り込むとエラー文言が出る', async () => {
    const user = userEvent.setup();
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

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
    renderWithLang(<SettingsScreen trips={[trip]} activeTrip={trip} onSelectTrip={() => {}} />);

    expect(screen.getByText(/個別 ¥50,000 \/ 共有 ¥30,000/)).toBeInTheDocument();
  });

  it('片方だけ設定されていればその側だけ出す', async () => {
    const trip = await createTrip({
      name: 'NY',
      currency: 'USD',
      homeCurrency: 'JPY',
      sharedBudgetHome: 30000,
    });
    renderWithLang(<SettingsScreen trips={[trip]} activeTrip={trip} onSelectTrip={() => {}} />);

    expect(screen.getByText(/\/ 共有 ¥30,000/)).toBeInTheDocument();
    expect(screen.queryByText(/個別 ¥/)).not.toBeInTheDocument();
  });
});

describe('SettingsScreen の表示設定', () => {
  it('言語を切り替えると画面の文言が変わる', async () => {
    const user = userEvent.setup();
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

    await user.selectOptions(screen.getByLabelText('言語'), 'en');

    expect(await screen.findByLabelText('Language')).toBeInTheDocument();
    expect(localStorage.getItem('trip-wallet:lang')).toBe('en');
  });

  it('換算先通貨の既定値を保存する', async () => {
    const user = userEvent.setup();
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

    await user.selectOptions(screen.getByLabelText('換算先通貨'), 'EUR');

    expect(localStorage.getItem('trip-wallet:home-currency')).toBe('EUR');
  });

  it('換算先が未保存なら、言語を切り替えたときに既定通貨も追随する', async () => {
    const user = userEvent.setup();
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);
    expect(screen.getByLabelText('換算先通貨')).toHaveValue('JPY');

    await user.selectOptions(screen.getByLabelText('言語'), 'en');

    expect(await screen.findByLabelText('Convert to')).toHaveValue('USD');
    // 追随するのは未保存のときだけ。保存済みの選択を言語で上書きしない
    expect(localStorage.getItem('trip-wallet:home-currency')).toBeNull();
  });

  it('取り込みエラーは選んでいる言語で出る', async () => {
    const user = userEvent.setup();
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />, 'en');

    const file = new File(['not json'], 'broken.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import'), file);

    expect(await screen.findByText('Could not read the file as JSON')).toBeInTheDocument();
  });
});

describe('サポートセクション', () => {
  it('表示条件を満たさないときは出さない', () => {
    vi.mocked(shouldShowDonation).mockReturnValue(false);
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);
    expect(screen.queryByRole('heading', { name: 'サポート' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ko-fi で支援する' })).toBeNull();
  });

  it('表示条件を満たすと Ko-fi への外部リンクを出す', () => {
    vi.mocked(shouldShowDonation).mockReturnValue(true);
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);
    expect(screen.getByRole('heading', { name: 'サポート' })).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Ko-fi で支援する' });
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/example');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('英語でも文言が切り替わる', () => {
    vi.mocked(shouldShowDonation).mockReturnValue(true);
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />, 'en');
    expect(screen.getByRole('link', { name: 'Support on Ko-fi' })).toBeInTheDocument();
  });
});
