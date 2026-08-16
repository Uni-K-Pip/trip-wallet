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
  // 直前の rAF タイムスタンプ。500ms 以内に次の値変化が来た場合はこれを新しい区間の
  // 起点として引き継ぐ。引き継がないと、値変化直後の最初のフレームは必ず t=0 になり
  // (start をそのフレームの now で初期化するため)、1 フレーム分「止まって見える」。
  // 前回の変化から 500ms 以上経っていれば古い時刻とみなして捨て、そのフレームの
  // 時刻を新しい起点にする(でないと長時間の無操作後に一瞬で最終値へ飛んでしまう)。
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = value;
      setShown(value);
      return;
    }

    const from = fromRef.current;
    if (from === value) return;

    let raf = 0;
    const prevTick = lastTickRef.current;
    let start = 0; // 最初のフレームで確定する(下記 primed 参照)。それまでは使わない。
    // この区間の起点をまだ確定させていないかどうか。確定判定はこの区間の最初の
    // フレームだけで行う(毎フレーム判定すると、500ms 経過ちょうどをまたぐ最終
    // フレームまで「間が空きすぎた」と誤判定して起点をリセットしてしまう)。
    let primed = false;
    const step = (now: number) => {
      if (!primed) {
        primed = true;
        start = prevTick === null || now - prevTick > DURATION ? now : prevTick;
      }
      lastTickRef.current = now;
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
