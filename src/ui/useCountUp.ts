import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './motion';

const DURATION = 500;

/** ease-out(三乗)。終盤ほどゆっくり止まって「数え上げた」感じになる。 */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * 金額を前回値から今の値へ 500ms でカウントアップさせる。
 * 初回マウント時は 0 から始める。「視差効果を減らす」設定なら即座に最終値を返す。
 *
 * 経過時間は performance.now() ではなく requestAnimationFrame が渡すタイムスタンプの
 * 差分で測る。テストのフェイクタイマー下でも同じ時計を使えるようにするため。
 */
export function useCountUp(value: number): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  // 今表示している値。途中で目標が変わっても、見えている値から続けて動かすために保持する。
  const fromRef = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = value;
      setShown(value);
      return;
    }

    const from = fromRef.current;
    if (from === value) return;

    let raf = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      const current = Math.round(from + (value - from) * easeOut(t));
      fromRef.current = current;
      setShown(current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return shown;
}
