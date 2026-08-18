import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/LangContext';
import { prefersReducedMotion } from './motion';

/** 閉じアニメーションの長さ。styles.css の .sheet.closing と合わせる。 */
const CLOSE_MS = 180;

/** 開いているシートの枚数。0 になったときだけ body のクラスを外す。 */
let openSheets = 0;

function retainTabbarHidden() {
  openSheets += 1;
  document.body.classList.add('sheet-open');
}

function releaseTabbarHidden() {
  openSheets -= 1;
  if (openSheets <= 0) {
    openSheets = 0;
    document.body.classList.remove('sheet-open');
  }
}

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ title, onClose, children }: Props) {
  const { t } = useI18n();
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  // シートは半透明ガラスなので、背後のタブバーと FAB が透けて保存ボタンに重なって見える。
  // シートが 1 枚でも開いている間は両方消す。StrictMode の二重マウントでも増減が
  // 対になるよう、枚数をカウンタで持つ。
  useEffect(() => {
    retainTabbarHidden();
    return releaseTabbarHidden;
  }, []);

  // 閉じアニメーションを見せるためにアンマウントを 180ms 遅らせる。
  // 「視差効果を減らす」設定なら待たずに即座に閉じる。
  function requestClose() {
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(onClose, CLOSE_MS);
  }

  return (
    <div
      className={closing ? 'sheet-backdrop closing' : 'sheet-backdrop'}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={closing ? 'sheet closing' : 'sheet'}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <h2>{title}</h2>
          <button type="button" onClick={requestClose} aria-label={t.common.close}>
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
