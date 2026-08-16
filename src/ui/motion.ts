/**
 * OS の「視差効果を減らす」設定が有効かどうか。
 * CSS 側は styles.css の @media (prefers-reduced-motion: reduce) が一括で止めるので、
 * ここは JS で動かすアニメーション(カウントアップ・シートの閉じ待ち)専用。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
