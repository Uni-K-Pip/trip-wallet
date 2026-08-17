import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithLang } from '../test/renderWithLang';
import { stubMatchMedia } from '../test/matchMedia';
import { Sheet } from './Sheet';

afterEach(() => {
  vi.useRealTimers();
  stubMatchMedia(true);
});

function renderSheet(onClose: () => void) {
  renderWithLang(
    <Sheet title="テストシート" onClose={onClose}>
      <p>本文</p>
    </Sheet>,
  );
}

describe('Sheet', () => {
  it('「視差効果を減らす」が有効なら閉じアニメーションを挟まず即座に閉じる', () => {
    stubMatchMedia(true);
    const onClose = vi.fn();
    renderSheet(onClose);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).not.toHaveClass('closing');
  });

  it('通常設定では closing クラスが付き、180ms 後に onClose が呼ばれる', () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderSheet(onClose);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.getByRole('dialog')).toHaveClass('closing');
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('閉じる操作を連打しても onClose は 1 回しか呼ばれない', () => {
    stubMatchMedia(false);
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderSheet(onClose);

    const closeButton = screen.getByRole('button', { name: '閉じる' });
    fireEvent.click(closeButton);
    fireEvent.click(closeButton);
    fireEvent.click(closeButton);

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
