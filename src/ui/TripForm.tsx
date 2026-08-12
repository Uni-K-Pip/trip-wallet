import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { loadHomeCurrency } from '../app/settings';
import { countExpenses } from '../data/expenseRepo';
import { createTrip, updateTrip } from '../data/tripRepo';
import { CURRENCIES, currencyDecimals, currencyName } from '../domain/currency';
import { todayLocal } from '../domain/date';
import { formatMajor, parseMajorToMinor } from '../domain/money';
import type { Trip } from '../domain/types';
import { defaultHomeCurrency } from '../i18n';
import { useI18n } from '../i18n/LangContext';

type Props = {
  trip?: Trip;
  onDone: () => void;
  onCancel: () => void;
};

/** 空欄と数値として解釈できない入力は未設定(null)。マイナスは 0 に丸める。 */
function parseBudget(text: string, decimals: number): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || !Number.isFinite(Number(trimmed))) return null;
  return Math.max(0, parseMajorToMinor(trimmed, decimals));
}

export function TripForm({ trip, onDone, onCancel }: Props) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(trip?.name ?? '');
  const [currency, setCurrency] = useState(trip?.currency ?? 'USD');
  // 換算先の初期値は 既存の旅行 → アプリ設定 → 端末の言語からの推定 の順
  const [homeCurrency, setHomeCurrency] = useState(
    trip?.homeCurrency ?? loadHomeCurrency() ?? defaultHomeCurrency(lang),
  );
  const homeDecimals = currencyDecimals(homeCurrency);
  const [startDate, setStartDate] = useState(trip?.startDate ?? todayLocal());
  const [endDate, setEndDate] = useState(trip?.endDate ?? '');
  const [personalBudget, setPersonalBudget] = useState(
    trip?.personalBudgetHome == null
      ? ''
      : formatMajor(trip.personalBudgetHome, trip.homeCurrencyDecimals).replace(/,/g, ''),
  );
  const [sharedBudget, setSharedBudget] = useState(
    trip?.sharedBudgetHome == null
      ? ''
      : formatMajor(trip.sharedBudgetHome, trip.homeCurrencyDecimals).replace(/,/g, ''),
  );
  const [memberCount, setMemberCount] = useState(String(trip?.memberCount ?? 1));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const expenseCount = useLiveQuery(() => (trip ? countExpenses(trip.id) : 0), [trip?.id], 0);
  const lockCurrency = expenseCount > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') {
      setError(t.trip.needName);
      return;
    }

    setSaving(true);
    const input = {
      name: name.trim(),
      currency,
      homeCurrency,
      startDate,
      endDate: endDate === '' ? null : endDate,
      personalBudgetHome: parseBudget(personalBudget, homeDecimals),
      sharedBudgetHome: parseBudget(sharedBudget, homeDecimals),
      memberCount: Math.max(1, Math.round(Number(memberCount) || 1)),
    };

    try {
      if (trip) await updateTrip(trip.id, input);
      else await createTrip(input);
      onDone();
    } catch {
      setError(t.trip.saveFailed);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label htmlFor="trip-name">{t.trip.name}</label>
      <input
        id="trip-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.trip.namePlaceholder}
      />

      <label htmlFor="trip-currency">{t.trip.currency}</label>
      <select
        id="trip-currency"
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        disabled={lockCurrency}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code} — {currencyName(c.code, lang)}
          </option>
        ))}
      </select>

      <label htmlFor="trip-home-currency">{t.trip.homeCurrency}</label>
      <select
        id="trip-home-currency"
        value={homeCurrency}
        onChange={(e) => setHomeCurrency(e.target.value)}
        disabled={lockCurrency}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code} — {currencyName(c.code, lang)}
          </option>
        ))}
      </select>
      {lockCurrency && <p className="hint">{t.trip.lockedByExpenses}</p>}

      <label htmlFor="trip-start">{t.trip.start}</label>
      <input
        id="trip-start"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      <label htmlFor="trip-end">{t.trip.end}</label>
      <input
        id="trip-end"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
      />

      <label htmlFor="trip-personal-budget">{t.trip.personalBudget(homeCurrency)}</label>
      <input
        id="trip-personal-budget"
        inputMode={homeDecimals > 0 ? 'decimal' : 'numeric'}
        value={personalBudget}
        onChange={(e) => setPersonalBudget(e.target.value)}
        placeholder={t.common.unset}
      />

      <label htmlFor="trip-shared-budget">{t.trip.sharedBudget(homeCurrency)}</label>
      <input
        id="trip-shared-budget"
        inputMode={homeDecimals > 0 ? 'decimal' : 'numeric'}
        value={sharedBudget}
        onChange={(e) => setSharedBudget(e.target.value)}
        placeholder={t.common.unset}
      />

      <label htmlFor="trip-members">{t.trip.members}</label>
      <input
        id="trip-members"
        inputMode="numeric"
        value={memberCount}
        onChange={(e) => setMemberCount(e.target.value)}
      />

      {error !== '' && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {t.common.save}
        </button>
      </div>
    </form>
  );
}
