import { SettingsScreen } from '../ui/SettingsScreen';
import { useActiveTrip } from './useActiveTrip';

export function App() {
  const { trips, activeTrip, loading, selectTrip } = useActiveTrip();

  if (loading) {
    return (
      <main className="screen">
        <p className="empty">読み込み中…</p>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="app-header">
        <h1>Trip Wallet</h1>
      </header>
      <SettingsScreen trips={trips} activeTrip={activeTrip} onSelectTrip={selectTrip} />
    </main>
  );
}
