import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ChangeEvent } from 'react';
import { DONATION_URL, shouldShowDonation } from '../app/donation';
import { loadHomeCurrency, saveHomeCurrency } from '../app/settings';
import {
  BackupError,
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
} from '../data/backup';
import { countCachedRates } from '../data/rateCacheRepo';
import { deleteTrip } from '../data/tripRepo';
import { CURRENCIES, currencyName } from '../domain/currency';
import { formatDateLabel } from '../domain/date';
import { formatWithCurrency } from '../domain/money';
import type { Trip } from '../domain/types';
import { LANGS, LANG_LABELS, defaultHomeCurrency } from '../i18n';
import type { Lang } from '../i18n';
import { useI18n } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { TripForm } from './TripForm';

type Props = {
  trips: Trip[];
  activeTrip: Trip | null;
  onSelectTrip: (id: string) => void;
};

export function SettingsScreen({ trips, activeTrip, onSelectTrip }: Props) {
  const { t, lang, setLang } = useI18n();
  const [editing, setEditing] = useState<Trip | 'new' | null>(null);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(loadHomeCurrency);
  const homeCurrency = saved ?? defaultHomeCurrency(lang);
  const rateCount = useLiveQuery(() => countCachedRates(), [], 0);

  /** 設定されている側だけを ` / 個別 ¥50,000 / 共有 ¥30,000` の形で返す。両方未設定なら空文字。 */
  const budgetLabel = (trip: Trip): string => {
    const parts: string[] = [];
    if (trip.personalBudgetHome !== null) {
      parts.push(t.settings.budgetPersonal(formatWithCurrency(trip.personalBudgetHome, trip.homeCurrency)));
    }
    if (trip.sharedBudgetHome !== null) {
      parts.push(t.settings.budgetShared(formatWithCurrency(trip.sharedBudgetHome, trip.homeCurrency)));
    }
    return parts.join('');
  };

  const importErrorMessage = (err: unknown): string => {
    if (!(err instanceof BackupError)) return t.backup.error.unknown;
    if (err.code === 'unsupported-version') return t.backup.error['unsupported-version'](err.detail ?? '');
    return t.backup.error[err.code];
  };

  async function handleExport() {
    try {
      const json = serializeBackup(await exportBackup());
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      // revokeObjectURL を click() の直後に呼ぶと、ブラウザによってはダウンロード
      // 開始前に URL が無効化されてしまうことがあるため、次のタスクまで遅らせる
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(t.settings.exported);
    } catch {
      setMessage(t.settings.exportFailed);
    }
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを選び直せるようにする
    if (!file) return;

    try {
      const result = await importBackup(parseBackup(await file.text()));
      setMessage(t.settings.imported(result.trips, result.expenses));
    } catch (err) {
      setMessage(importErrorMessage(err));
    }
  }

  async function handleDelete(trip: Trip) {
    if (!confirm(t.settings.confirmDelete(trip.name))) return;
    await deleteTrip(trip.id);
    setMessage(t.settings.deleted(trip.name));
  }

  return (
    <div className="settings">
      <section>
        <h3>{t.settings.display}</h3>
        <div className="form">
          <label>
            {t.settings.language}
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {LANG_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.settings.homeCurrency}
            <select
              value={homeCurrency}
              onChange={(e) => {
                setSaved(e.target.value);
                saveHomeCurrency(e.target.value);
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {currencyName(c.code, lang)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">{t.settings.homeCurrencyHint}</p>
      </section>

      <section>
        <div className="section-head">
          <h3>{t.settings.trips}</h3>
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            {t.common.add}
          </button>
        </div>

        {trips.length === 0 && <p className="empty">{t.settings.tripsEmpty}</p>}

        <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.id} className={trip.id === activeTrip?.id ? 'trip active' : 'trip'}>
              <button type="button" className="trip-main" onClick={() => onSelectTrip(trip.id)}>
                <span className="trip-name">{trip.name}</span>
                <span className="trip-meta">
                  {trip.currency} / {formatDateLabel(trip.startDate, t)}
                  {trip.endDate ? `〜${formatDateLabel(trip.endDate, t)}` : ''} /{' '}
                  {t.common.people(trip.memberCount)}
                  {budgetLabel(trip)}
                </span>
              </button>
              <button type="button" className="btn-ghost" onClick={() => setEditing(trip)}>
                {t.common.edit}
              </button>
              <button type="button" className="btn-danger" onClick={() => handleDelete(trip)}>
                {t.common.delete}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>{t.settings.data}</h3>
        <p className="hint">{t.settings.dataHint}</p>
        <div className="form-actions">
          <button type="button" className="btn-primary" onClick={handleExport}>
            {t.settings.export}
          </button>
          <label className="btn-ghost file-label">
            {t.settings.import}
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
        </div>
        <p className="hint">{t.settings.importHint}</p>
      </section>

      {shouldShowDonation() && (
        <section>
          <h3>{t.settings.support}</h3>
          <p className="hint">{t.settings.supportHint}</p>
          <div className="form-actions">
            <a
              className="btn-ghost link-btn"
              href={DONATION_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.settings.supportLink}
            </a>
          </div>
        </section>
      )}

      <section>
        <h3>{t.settings.rateCache}</h3>
        <p className="hint">{t.settings.rateCacheHint(rateCount ?? 0)}</p>
      </section>

      {message !== '' && <p className="toast">{message}</p>}

      {editing !== null && (
        <Sheet
          title={editing === 'new' ? t.settings.tripAdd : t.settings.tripEdit}
          onClose={() => setEditing(null)}
        >
          <TripForm
            trip={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </Sheet>
      )}
    </div>
  );
}
