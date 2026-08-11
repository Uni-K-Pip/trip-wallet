import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WHEEL_ITEM_HEIGHT, WheelPicker, indexFromScroll, offsetForIndex } from './WheelPicker';

describe('indexFromScroll', () => {
  it('項目高の倍数はそのままインデックスになる', () => {
    expect(indexFromScroll(0, 44, 3)).toBe(0);
    expect(indexFromScroll(44, 44, 3)).toBe(1);
    expect(indexFromScroll(88, 44, 3)).toBe(2);
  });

  it('半端な位置は近い方に丸める', () => {
    expect(indexFromScroll(21, 44, 3)).toBe(0);
    expect(indexFromScroll(23, 44, 3)).toBe(1);
  });

  it('範囲外は両端にクランプする', () => {
    expect(indexFromScroll(-100, 44, 3)).toBe(0);
    expect(indexFromScroll(9999, 44, 3)).toBe(2);
  });

  it('項目が無ければ 0 を返す', () => {
    expect(indexFromScroll(44, 44, 0)).toBe(0);
  });
});

describe('offsetForIndex', () => {
  it('インデックス × 項目高', () => {
    expect(offsetForIndex(0, 44)).toBe(0);
    expect(offsetForIndex(2, 44)).toBe(88);
  });

  it('indexFromScroll と往復する', () => {
    for (const i of [0, 1, 4]) {
      expect(indexFromScroll(offsetForIndex(i, WHEEL_ITEM_HEIGHT), WHEEL_ITEM_HEIGHT, 5)).toBe(i);
    }
  });
});

describe('WheelPicker', () => {
  const items = [
    { id: 'a', label: '上海 2026-09' },
    { id: 'b', label: 'NY 2026-09' },
  ];

  it('listbox として項目を並べる', () => {
    render(<WheelPicker items={items} selectedId="a" onChange={() => {}} label="旅行" />);

    expect(screen.getByRole('listbox', { name: '旅行' })).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '上海 2026-09',
      'NY 2026-09',
    ]);
  });

  it('選択中の項目に aria-selected を付ける', () => {
    render(<WheelPicker items={items} selectedId="b" onChange={() => {}} label="旅行" />);

    expect(screen.getByRole('option', { name: 'NY 2026-09' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: '上海 2026-09' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('項目をタップすると onChange が呼ばれる', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WheelPicker items={items} selectedId="a" onChange={onChange} label="旅行" />);

    await user.click(screen.getByRole('option', { name: 'NY 2026-09' }));

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('選択中の項目をタップしても onChange は呼ばない', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WheelPicker items={items} selectedId="a" onChange={onChange} label="旅行" />);

    await user.click(screen.getByRole('option', { name: '上海 2026-09' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
