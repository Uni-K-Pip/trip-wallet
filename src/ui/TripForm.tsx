import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { countExpenses } from '../data/expenseRepo';
import { createTrip, updateTrip } from '../data/tripRepo';
import { CURRENCIES } from '../domain/currency';
import { todayLocal } from '../domain/date';
import type { Trip } from '../domain/types';

type Props = {
  trip?: Trip;
  onDone: () => void;
  onCancel: () => void;
};

export function TripForm({ trip, onDone, onCancel }: Props) {
  const [name, setName] = useState(trip?.name ?? '');
  const [currency, setCurrency] = useState(trip?.currency ?? 'USD');
  const [startDate, setStartDate] = useState(trip?.startDate ?? todayLocal());
  const [endDate, setEndDate] = useState(trip?.endDate ?? '');
  const [budget, setBudget] = useState(
    trip === undefined || trip.personalBudgetJpy === null ? '' : String(trip.personalBudgetJpy),
  );
  const [memberCount, setMemberCount] = useState(String(trip?.memberCount ?? 1));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const expenseCount = useLiveQuery(() => (trip ? countExpenses(trip.id) : 0), [trip?.id], 0);
  const lockCurrency = expenseCount > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') {
      setError('旅行名を入力してください');
      return;
    }

    setSaving(true);
    // "1.2.3" や "abc" など数値として解釈できない入力は NaN のまま保存せず null にする
    const parsedBudget = Number(budget);
    const personalBudgetJpy =
      budget.trim() === '' || !Number.isFinite(parsedBudget)
        ? null
        : Math.max(0, Math.round(parsedBudget));
    const input = {
      name: name.trim(),
      currency,
      startDate,
      endDate: endDate === '' ? null : endDate,
      personalBudgetJpy,
      memberCount: Math.max(1, Math.round(Number(memberCount) || 1)),
    };

    try {
      if (trip) await updateTrip(trip.id, input);
      else await createTrip(input);
      onDone();
    } catch {
      setError('保存できませんでした');
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label htmlFor="trip-name">旅行名</label>
      <input
        id="trip-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="NY 2026-09"
      />

      <label htmlFor="trip-currency">通貨</label>
      <select
        id="trip-currency"
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        disabled={lockCurrency}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}({c.code})
          </option>
        ))}
      </select>
      {lockCurrency && <p className="hint">支出があるため通貨は変更できません。</p>}

      <label htmlFor="trip-start">開始日</label>
      <input
        id="trip-start"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      <label htmlFor="trip-end">終了日</label>
      <input
        id="trip-end"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
      />

      <label htmlFor="trip-budget">予算(円)</label>
      <input
        id="trip-budget"
        inputMode="numeric"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        placeholder="未設定"
      />

      <label htmlFor="trip-members">人数</label>
      <input
        id="trip-members"
        inputMode="numeric"
        value={memberCount}
        onChange={(e) => setMemberCount(e.target.value)}
      />

      {error !== '' && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          保存
        </button>
      </div>
    </form>
  );
}
