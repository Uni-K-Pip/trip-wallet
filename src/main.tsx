import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { listTrips } from './data/tripRepo';
import { prefetchTodayRate } from './rates/resolveRate';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// 現地で電波が悪くても入力が止まらないよう、起動時に当日レートを取っておく
// 先読みはベストエフォートなので、失敗しても画面表示を妨げないよう握りつぶす
void listTrips()
  .then((trips) => {
    for (const currency of new Set(trips.map((t) => t.currency))) {
      void prefetchTodayRate(currency).catch(() => {});
    }
  })
  .catch(() => {});
