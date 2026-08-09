import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { deleteExpense, listExpenses } from '../data/expenseRepo';
import { getPhoto } from '../data/photoRepo';
import { categoryIcon, categoryLabel, scopeLabel } from '../domain/categories';
import { formatDateLabel } from '../domain/date';
import { formatJpy, formatWithCurrency } from '../domain/money';
import { expenseJpy, groupByDate, summarize } from '../domain/summary';
import type { Expense, Trip } from '../domain/types';
import { ExpenseSheet } from './ExpenseSheet';

function PhotoThumb({ photoId }: { photoId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void getPhoto(photoId).then((blob) => {
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  return url === null ? null : <img className="thumb" src={url} alt="レシート" />;
}

export function HomeScreen({ trip }: { trip: Trip }) {
  const expenses = useLiveQuery(() => listExpenses(trip.id), [trip.id]);
  const [sheet, setSheet] = useState<Expense | 'new' | null>(null);
  const [message, setMessage] = useState('');

  // useLiveQuery は初回レンダーで undefined を返す(IndexedDB への問い合わせは非同期のため)。
  // ここで早期returnしないと、data-testid を持つ要素が ¥0 の状態で先に DOM に現れてしまい、
  // findBy* が「要素の出現」だけを待って中身が確定する前の値で assert してしまう。
  if (expenses === undefined) {
    return (
      <div className="home">
        <p className="empty">読み込み中…</p>
      </div>
    );
  }

  const list = expenses;
  const summary = summarize(list, trip);
  const groups = groupByDate(list, trip);
  const usedRatio =
    summary.budgetJpy === null || summary.budgetJpy === 0
      ? 0
      : Math.min(1, summary.totalJpy / summary.budgetJpy);

  async function handleDelete(e: Expense) {
    if (!confirm('この支出を削除しますか?')) return;
    await deleteExpense(e.id);
    setMessage('削除しました');
  }

  return (
    <div className="home">
      <div className="card">
        <div className="card-total">
          <span className="card-label">合計</span>
          <span className="card-jpy" data-testid="total-jpy">
            {formatJpy(summary.totalJpy)}
          </span>
          <span className="card-foreign">
            {formatWithCurrency(summary.totalMinor, trip.currency)} / {summary.count}件
          </span>
        </div>

        <div className="card-split">
          <div>
            <span className="card-label">個別</span>
            <span data-testid="personal-jpy">{formatJpy(summary.personalJpy)}</span>
          </div>
          <div>
            <span className="card-label">共有</span>
            <span data-testid="shared-jpy">{formatJpy(summary.sharedJpy)}</span>
            <span className="card-sub" data-testid="shared-per-person">
              自分の負担 {formatJpy(summary.sharedPerPersonJpy)}({trip.memberCount}人)
            </span>
          </div>
        </div>

        {summary.budgetJpy !== null && summary.remainingJpy !== null && (
          <div className="budget">
            <div className="budget-bar">
              <div
                className={usedRatio >= 1 ? 'budget-fill over' : 'budget-fill'}
                style={{ width: `${usedRatio * 100}%` }}
              />
            </div>
            <span className="card-sub" data-testid="remaining-jpy">
              予算 {formatJpy(summary.budgetJpy)} / 残り {formatJpy(summary.remainingJpy)}
            </span>
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <p className="empty">まだ支出がありません。右下の + から追加してください。</p>
      )}

      {groups.map((group) => (
        <section key={group.date} className="day">
          <div className="day-head">
            <h3>{formatDateLabel(group.date)}</h3>
            <span className="card-sub">{formatJpy(group.jpy)}</span>
          </div>
          <ul className="ex-list">
            {group.expenses.map((e) => (
              <li key={e.id} className="ex-row">
                <button type="button" className="ex-main" onClick={() => setSheet(e)}>
                  <span className="ex-icon">{categoryIcon(e.category)}</span>
                  <span className="ex-text">
                    <span className="ex-memo">
                      {e.memo === '' ? categoryLabel(e.category) : e.memo}
                    </span>
                    <span className="ex-sub">
                      {formatWithCurrency(e.amountMinor, trip.currency)} →{' '}
                      {formatJpy(expenseJpy(e, trip))}
                    </span>
                  </span>
                  <span className={e.scope === 'shared' ? 'badge shared' : 'badge'}>
                    {scopeLabel(e.scope)}
                  </span>
                </button>
                {e.photoId !== null && <PhotoThumb photoId={e.photoId} />}
                <button
                  type="button"
                  className="btn-danger"
                  aria-label="削除"
                  onClick={() => handleDelete(e)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <button type="button" className="fab" aria-label="支出を追加" onClick={() => setSheet('new')}>
        ＋
      </button>

      {message !== '' && <p className="toast">{message}</p>}

      {sheet !== null && (
        <ExpenseSheet
          trip={trip}
          expense={sheet === 'new' ? undefined : sheet}
          onClose={(m) => {
            setSheet(null);
            if (m) setMessage(m);
          }}
        />
      )}
    </div>
  );
}
