import { useEffect, useRef } from 'react';

/** 1 項目の高さ(px)。CSS の .wheel-item と必ず揃える。 */
export const WHEEL_ITEM_HEIGHT = 44;

/** スクロールが止まったとみなすまでの待ち時間(ms)。 */
const SCROLL_SETTLE_MS = 100;

export type WheelItem = { id: string; label: string };

/** スクロール位置から選択インデックスを求める。範囲外は両端にクランプする。 */
export function indexFromScroll(scrollTop: number, itemHeight: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollTop / itemHeight)));
}

/** インデックスに対応するスクロール位置を返す。 */
export function offsetForIndex(index: number, itemHeight: number): number {
  return index * itemHeight;
}

type Props = {
  items: WheelItem[];
  selectedId: string;
  onChange: (id: string) => void;
  /** listbox の読み上げ名 */
  label: string;
};

export function WheelPicker({ items, selectedId, onChange, label }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // マウント時だけ、開いた時点の選択位置へ合わせる。以後はスクロール操作が選択を決めるので
  // selectedId の変化で位置を戻してはいけない(指の動きと喧嘩する)。
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const index = items.findIndex((i) => i.id === selectedId);
    el.scrollTop = offsetForIndex(index < 0 ? 0 : index, WHEEL_ITEM_HEIGHT);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    // scrollend は Safari が未対応なので、止まったとみなせるまで待ってから位置を拾う
    if (timer.current !== null) clearTimeout(timer.current);
    const scrollTop = el.scrollTop;
    timer.current = setTimeout(() => {
      const item = items[indexFromScroll(scrollTop, WHEEL_ITEM_HEIGHT, items.length)];
      if (item !== undefined && item.id !== selectedId) onChange(item.id);
    }, SCROLL_SETTLE_MS);
  }

  // 実機でスナップが効かない場合でも操作が詰まないよう、タップでも選べるようにする
  function handlePick(index: number) {
    const el = listRef.current;
    if (el) el.scrollTop = offsetForIndex(index, WHEEL_ITEM_HEIGHT);
    const item = items[index];
    if (item.id !== selectedId) onChange(item.id);
  }

  return (
    <div className="wheel">
      <div className="wheel-highlight" aria-hidden="true" />
      <div
        className="wheel-list"
        ref={listRef}
        role="listbox"
        aria-label={label}
        onScroll={handleScroll}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={item.id === selectedId}
            className={item.id === selectedId ? 'wheel-item selected' : 'wheel-item'}
            onClick={() => handlePick(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
