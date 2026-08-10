import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('テスト用の例外');
}

describe('ErrorBoundary', () => {
  it('子コンポーネントが throw すると fallback を表示する', () => {
    // React は catch されたエラーもコンソールに出力するので黙らせる
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(screen.getByText('テスト用の例外')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument();
  });

  it('throw しない子はそのまま描画される', () => {
    render(
      <ErrorBoundary>
        <p>問題なし</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('問題なし')).toBeInTheDocument();
    expect(screen.queryByText('エラーが発生しました')).not.toBeInTheDocument();
  });
});
