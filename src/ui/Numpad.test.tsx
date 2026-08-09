import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Numpad, pressKey } from './Numpad';

describe('pressKey', () => {
  it('数字を末尾に足す', () => {
    expect(pressKey('', '1', 2)).toBe('1');
    expect(pressKey('12', '3', 2)).toBe('123');
  });

  it('先頭の 0 は次の数字で置き換える', () => {
    expect(pressKey('0', '5', 2)).toBe('5');
    expect(pressKey('0', '0', 2)).toBe('0');
  });

  it('小数点が無いところに . を押すと 0. になる', () => {
    expect(pressKey('', '.', 2)).toBe('0.');
    expect(pressKey('12', '.', 2)).toBe('12.');
  });

  it('小数点は 1 つまで', () => {
    expect(pressKey('12.3', '.', 2)).toBe('12.3');
  });

  it('小数桁が 0 の通貨では . を無視する', () => {
    expect(pressKey('15000', '.', 0)).toBe('15000');
  });

  it('小数部が桁数に達したら足さない', () => {
    expect(pressKey('12.34', '5', 2)).toBe('12.34');
    expect(pressKey('12.3', '4', 2)).toBe('12.34');
  });

  it('整数部は 9 桁まで', () => {
    expect(pressKey('123456789', '0', 2)).toBe('123456789');
  });

  it('del で末尾を削る', () => {
    expect(pressKey('12.3', 'del', 2)).toBe('12.');
    expect(pressKey('1', 'del', 2)).toBe('');
    expect(pressKey('', 'del', 2)).toBe('');
  });
});

describe('Numpad', () => {
  it('押したキーを onChange に渡す', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Numpad value="1" decimals={2} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(onChange).toHaveBeenCalledWith('12');
  });

  it('小数桁が 0 の通貨では . を押せない', () => {
    render(<Numpad value="" decimals={0} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '.' })).toBeDisabled();
  });
});
