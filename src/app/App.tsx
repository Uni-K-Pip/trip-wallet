import { useState } from 'react';
import { HomeScreen } from '../ui/HomeScreen';
import { SettingsScreen } from '../ui/SettingsScreen';
import { SummaryScreen } from '../ui/SummaryScreen';
import { useActiveTrip } from './useActiveTrip';

type Tab = 'home' | 'summary' | 'settings';

export function App() {
  const { trips, activeTrip, loading, selectTrip } = useActiveTrip();
  const [tab, setTab] = useState<Tab>('home');

  if (loading) {
    return (
      <main className="screen">
        <p className="empty">読み込み中…</p>
      </main>
    );
  }

  return (
    <>
      <main className="screen">
        <header className="app-header">
          <h1>{activeTrip?.name ?? 'Trip Wallet'}</h1>
        </header>

        {tab === 'home' &&
          (activeTrip !== null ? (
            <HomeScreen trip={activeTrip} />
          ) : (
            <p className="empty">まず「設定」タブで旅行を作成してください。</p>
          ))}

        {tab === 'summary' &&
          (activeTrip !== null ? (
            <SummaryScreen trip={activeTrip} />
          ) : (
            <p className="empty">まず「設定」タブで旅行を作成してください。</p>
          ))}

        {tab === 'settings' && (
          <SettingsScreen trips={trips} activeTrip={activeTrip} onSelectTrip={selectTrip} />
        )}
      </main>

      <nav className="tabbar">
        <button
          type="button"
          className={tab === 'home' ? 'tab active' : 'tab'}
          onClick={() => setTab('home')}
        >
          🏠 ホーム
        </button>
        <button
          type="button"
          className={tab === 'summary' ? 'tab active' : 'tab'}
          onClick={() => setTab('summary')}
        >
          📊 集計
        </button>
        <button
          type="button"
          className={tab === 'settings' ? 'tab active' : 'tab'}
          onClick={() => setTab('settings')}
        >
          ⚙️ 設定
        </button>
      </nav>
    </>
  );
}
