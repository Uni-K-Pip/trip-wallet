import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountUp } from './useCountUp';

/** setup.ts の既定(reduced-motion = true)を、このテストの中だけ上書きする。 */
function setReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  vi.useRealTimers();
  setReducedMotion(true);
});

describe('useCountUp', () => {
  it('視差効果を減らす設定なら最初から最終値を返す', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useCountUp(5116));
    expect(result.current).toBe(5116);
  });

  it('初回は 0 から始まり、500ms 後に最終値へ届く', () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountUp(5116));

    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(5116);
  });

  it('値が変わると前回値から新しい値へ動く', () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), {
      initialProps: { v: 1000 },
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(1000);

    rerender({ v: 2000 });
    act(() => {
      vi.advanceTimersByTime(16);
    });
    // 途中経過は前回値と新しい値のあいだにいる(0 に戻らない)
    expect(result.current).toBeGreaterThan(1000);
    expect(result.current).toBeLessThan(2000);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(2000);
  });
});
