import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 現地で電波が悪くても入力が止まらないよう、起動時に当日レートを取っておく
void import('./rates/resolveRate').then(async ({ prefetchTodayRate }) => {
  const { listTrips } = await import('./data/tripRepo');
  const trips = await listTrips();
  for (const currency of new Set(trips.map((t) => t.currency))) {
    void prefetchTodayRate(currency);
  }
});
