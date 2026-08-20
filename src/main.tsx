import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { countLaunch } from './app/analytics';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { listTrips } from './data/tripRepo';
import { LangProvider } from './i18n/LangContext';
import { prefetchTodayRate } from './rates/resolveRate';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LangProvider>
        <App />
      </LangProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// 現地で電波が悪くても入力が止まらないよう、起動時に当日レートを取っておく
// 先読みはベストエフォートなので、失敗しても画面表示を妨げないよう握りつぶす
// 旅行ごとに換算先が違うので、通貨ペア単位で重複を除く
void listTrips()
  .then((trips) => {
    for (const pair of new Set(trips.map((t) => `${t.currency}:${t.homeCurrency}`))) {
      const [base, quote] = pair.split(':');
      void prefetchTodayRate(base, quote).catch(() => {});
    }
  })
  .catch(() => {});

// 起動回数を GoatCounter に 1 回だけ送る。サイトコードが空のあいだは何も起きない
// React ツリーの外なので StrictMode の二重実行に巻き込まれない
// countLaunch は Promise を返さない(内部で握りつぶす)ので void 演算子は付けない
countLaunch();
