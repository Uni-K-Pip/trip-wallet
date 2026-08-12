import { Component, type ReactNode } from 'react';
import { detectLang } from '../i18n';
import { DICTIONARIES } from '../i18n/dictionaries';
import { loadLang } from './settings';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * ローカルデータしか持たないこのアプリでは、レンダー時例外で React が
 * ルートごとアンマウントして白画面になる = サイトデータ全消しへの入口になりかねない。
 * そのため上位で捕まえて、リロード導線だけは残す。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(error, info);
  }

  render() {
    if (this.state.error) {
      // Provider の外なので自前で言語を決める。ここが動くのは既に何かが壊れている場面なので、
      // 保存値が読めなければ端末の言語にフォールバックする。
      const t = DICTIONARIES[loadLang() ?? detectLang()];
      return (
        <div className="screen">
          <p className="empty">{t.error.title}</p>
          <p className="error">{this.state.error.message}</p>
          <button type="button" className="btn-primary" onClick={() => location.reload()}>
            {t.error.reload}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
