import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { deleteExpense, listExpenses } from '../data/expenseRepo';
import { getPhoto } from '../data/photoRepo';
import { categoryIcon } from '../domain/categories';
import { formatDateLabel } from '../domain/date';
import { formatWithCurrency } from '../domain/money';
import { expenseHome, groupByDate, summarize } from '../domain/summary';
import type { Expense, Trip } from '../domain/types';
import { useI18n } from '../i18n/LangContext';
import { ExpenseSheet } from './ExpenseSheet';

function PhotoThumb({ photoId }: { photoId: string }) {
  const { t } = useI18n();
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

  return url === null ? null : <img className="thumb" src={url} alt={t.home.receipt} />;
}

function BudgetBar({
  label,
  budgetHome,
  usedHome,
  remainingHome,
  currency,
  testId,
}: {
  label: string;
  budgetHome: number;
  usedHome: number;
  remainingHome: number;
  currency: string;
  testId: string;
}) {
  const { t } = useI18n();
  // 予算 0 のときは 0 除算を避けて使用率 0 として扱う
  const usedRatio = budgetHome === 0 ? 0 : Math.min(1, usedHome / budgetHome);

  return (
    <div className="budget">
      <div className="budget-bar">
        <div
          className={usedRatio >= 1 ? 'budget-fill over' : 'budget-fill'}
          style={{ width: `${usedRatio * 100}%` }}
        />
      </div>
      <span className="card-sub" data-testid={testId}>
        {label} {formatWithCurrency(budgetHome, currency)} /{' '}
        {t.home.remaining(formatWithCurrency(remainingHome, currency))}
      </span>
    </div>
  );
}

export function HomeScreen({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const expenses = useLiveQuery(() => listExpenses(trip.id), [trip.id]);
  const [sheet, setSheet] = useState<Expense | 'new' | null>(null);
  const [message, setMessage] = useState('');

  // useLiveQuery は初回レンダーで undefined を返す(IndexedDB への問い合わせは非同期のため)。
  // ここで早期returnしないと、data-testid を持つ要素が ¥0 の状態で先に DOM に現れてしまい、
  // findBy* が「要素の出現」だけを待って中身が確定する前の値で assert してしまう。
  if (expenses === undefined) {
    return (
      <div className="home">
        <p className="empty">{t.common.loading}</p>
      </div>
    );
  }

  const list = expenses;
  const summary = summarize(list, trip);
  const groups = groupByDate(list, trip);

  async function handleDelete(e: Expense) {
    if (!confirm(t.home.confirmDelete)) return;
    try {
      await deleteExpense(e.id);
      setMessage(t.home.deleted);
    } catch {
      setMessage(t.home.deleteFailed);
    }
  }

  return (
    <div className="home">
      <div className="card">
        <div className="card-total">
          <span className="card-label">{t.home.total}</span>
          <span className="card-jpy" data-testid="total-home">
            {formatWithCurrency(summary.totalHome, trip.homeCurrency)}
          </span>
          <span className="card-foreign">
            {formatWithCurrency(summary.totalMinor, trip.currency)} / {t.common.items(summary.count)}
          </span>
        </div>

        <div className="card-split">
          <div>
            <span className="card-label">{t.scope.personal}</span>
            <span data-testid="personal-home">
              {formatWithCurrency(summary.personalHome, trip.homeCurrency)}
            </span>
          </div>
          <div>
            <span className="card-label">{t.scope.shared}</span>
            <span data-testid="shared-home">
              {formatWithCurrency(summary.sharedHome, trip.homeCurrency)}
            </span>
            <span className="card-sub" data-testid="shared-per-person">
              {t.home.myShare(
                formatWithCurrency(summary.sharedPerPersonHome, trip.homeCurrency),
                trip.memberCount,
              )}
            </span>
          </div>
        </div>

        {summary.personalBudgetHome !== null && summary.personalRemainingHome !== null && (
          <BudgetBar
            label={t.home.personalBudget}
            budgetHome={summary.personalBudgetHome}
            usedHome={summary.personalHome}
            remainingHome={summary.personalRemainingHome}
            currency={trip.homeCurrency}
            testId="personal-remaining-home"
          />
        )}

        {summary.sharedBudgetHome !== null && summary.sharedRemainingHome !== null && (
          <BudgetBar
            label={t.home.sharedBudget}
            budgetHome={summary.sharedBudgetHome}
            usedHome={summary.sharedPerPersonHome}
            remainingHome={summary.sharedRemainingHome}
            currency={trip.homeCurrency}
            testId="shared-remaining-home"
          />
        )}
      </div>

      {groups.length === 0 && <p className="empty">{t.home.empty}</p>}

      {groups.map((group) => (
        <section key={group.date} className="day">
          <div className="day-head">
            <h3>{formatDateLabel(group.date, t.weekdays)}</h3>
            <span className="card-sub">{formatWithCurrency(group.home, trip.homeCurrency)}</span>
          </div>
          <ul className="ex-list">
            {group.expenses.map((e) => (
              <li key={e.id} className="ex-row">
                <button type="button" className="ex-main" onClick={() => setSheet(e)}>
                  <span className="ex-icon">{categoryIcon(e.category)}</span>
                  <span className="ex-text">
                    <span className="ex-memo">
                      {e.memo === '' ? t.category[e.category] : e.memo}
                    </span>
                    <span className="ex-sub">
                      {formatWithCurrency(e.amountMinor, trip.currency)}
                      {trip.currency !== trip.homeCurrency &&
                        ` → ${formatWithCurrency(expenseHome(e, trip), trip.homeCurrency)}`}
                    </span>
                  </span>
                  <span className={e.scope === 'shared' ? 'badge shared' : 'badge'}>
                    {t.scope[e.scope]}
                  </span>
                </button>
                {e.photoId !== null && <PhotoThumb photoId={e.photoId} />}
                <button
                  type="button"
                  className="btn-danger"
                  aria-label={t.common.delete}
                  onClick={() => handleDelete(e)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <button
        type="button"
        className="fab"
        aria-label={t.home.addExpense}
        onClick={() => setSheet('new')}
      >
        ＋
      </button>

      {message !== '' && <p className="toast">{message}</p>}

      {sheet !== null && (
        <ExpenseSheet
          // key を支出ごとに変えることで、開いたまま別の支出に切り替わったときに
          // ExpenseSheet を強制的に再マウントする。Sheet.tsx のバックドロップは
          // 実ブラウザのポインタ操作こそ遮るが、aria-hidden/inert/フォーカストラップ
          // が無いためキーボードの Tab フォーカスやスクリーンリーダーの読み上げ操作は
          // 背後の行に到達し得る。key が無いと ExpenseSheet 内部の useState 初期値
          // (amount/date/scope/category 等)はマウント時のみ評価されるため、
          // 古い支出の入力内容のまま新しい支出の id に保存されてしまう。
          key={sheet === 'new' ? 'new' : sheet.id}
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
