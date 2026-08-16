import { useEffect, useState } from 'react';
import { todayLocal } from '../domain/date';
import { useI18n } from '../i18n/LangContext';
import { HomeScreen } from '../ui/HomeScreen';
import { SettingsScreen } from '../ui/SettingsScreen';
import { SummaryScreen } from '../ui/SummaryScreen';
import { TripPickerSheet } from '../ui/TripPickerSheet';
import { usePwaUpdate, requestPersistentStorage } from './pwa';
import { dismissReminder, needsExportReminder, readDismissedReminder } from './reminders';
import { useActiveTrip } from './useActiveTrip';

type Tab = 'home' | 'summary' | 'settings';

export function App() {
  const { t } = useI18n();
  const { trips, activeTrip, loading, selectTrip } = useActiveTrip();
  const [tab, setTab] = useState<Tab>('home');
  const { needRefresh, updateApp } = usePwaUpdate();
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissedReminder());
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const showExportReminder = needsExportReminder(activeTrip, todayLocal(), dismissed);

  if (loading) {
    return (
      <main className="screen">
        <p className="empty">{t.common.loading}</p>
      </main>
    );
  }

  return (
    <>
      <main className="screen">
        <header className="app-header">
          {/* 設定タブには旅行リストがあるので切り替えボタンを出さない。
              旅行が 1 件以下のときも切り替える先が無いのでただの見出しにする。 */}
          {tab !== 'settings' && activeTrip !== null && trips.length > 1 ? (
            <h1>
              <button
                type="button"
                className="trip-switch"
                aria-haspopup="dialog"
                onClick={() => setPicking(true)}
              >
                {activeTrip.name}
                <span aria-hidden="true"> ▾</span>
              </button>
            </h1>
          ) : (
            <h1>{activeTrip?.name ?? t.appName}</h1>
          )}
        </header>

        {showExportReminder && activeTrip !== null && (
          <div className="banner">
            {/* 設定タブを開いているときに「設定へ」と言っても意味がないので、
                文言を書き分けてボタンを出さない。 */}
            <span>{tab === 'settings' ? t.app.exportReminderSettings : t.app.exportReminder}</span>
            {tab !== 'settings' && (
              <button type="button" className="btn-primary" onClick={() => setTab('settings')}>
                {t.app.toSettings}
              </button>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                dismissReminder(activeTrip.id);
                setDismissed(activeTrip.id);
              }}
            >
              {t.common.close}
            </button>
          </div>
        )}

        {/* key={tab} でタブ切替のたびに再マウントし、入場アニメーションを再生させる */}
        <div className="tab-panel" key={tab}>
          {tab === 'home' &&
            (activeTrip !== null ? (
              <HomeScreen trip={activeTrip} />
            ) : (
              <p className="empty">{t.app.noTrip}</p>
            ))}

          {tab === 'summary' &&
            (activeTrip !== null ? (
              <SummaryScreen trip={activeTrip} />
            ) : (
              <p className="empty">{t.app.noTrip}</p>
            ))}

          {tab === 'settings' && (
            <SettingsScreen trips={trips} activeTrip={activeTrip} onSelectTrip={selectTrip} />
          )}
        </div>
      </main>

      {picking && activeTrip !== null && (
        <TripPickerSheet
          trips={trips}
          activeTripId={activeTrip.id}
          onSelect={(id) => {
            selectTrip(id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {needRefresh && (
        <button type="button" className="toast update" onClick={updateApp}>
          {t.app.update}
        </button>
      )}

      <nav className="tabbar">
        <button
          type="button"
          className={tab === 'home' ? 'tab active' : 'tab'}
          onClick={() => setTab('home')}
        >
          {`🏠 ${t.app.tabHome}`}
        </button>
        <button
          type="button"
          className={tab === 'summary' ? 'tab active' : 'tab'}
          onClick={() => setTab('summary')}
        >
          {`📊 ${t.app.tabSummary}`}
        </button>
        <button
          type="button"
          className={tab === 'settings' ? 'tab active' : 'tab'}
          onClick={() => setTab('settings')}
        >
          {`⚙️ ${t.app.tabSettings}`}
        </button>
      </nav>
    </>
  );
}
