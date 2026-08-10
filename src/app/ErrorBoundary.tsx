import { Component, type ReactNode } from 'react';

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
      return (
        <div className="screen">
          <p className="empty">エラーが発生しました</p>
          <p className="error">{this.state.error.message}</p>
          <button type="button" className="btn-primary" onClick={() => location.reload()}>
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
