import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listExpenses } from '../data/expenseRepo';
import { formatWithCurrency } from '../domain/money';
import { breakdownByCategory, dailySeries, summarize } from '../domain/summary';
import type { ViewScope } from '../domain/summary';
import type { Trip } from '../domain/types';
import { useI18n } from '../i18n/LangContext';
import { CategoryChart } from './CategoryChart';
import { DailyChart } from './DailyChart';

const VIEWS: ViewScope[] = ['personal', 'shared', 'mine'];

export function SummaryScreen({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const expenses = useLiveQuery(() => listExpenses(trip.id), [trip.id]);
  // 切り替えはセッション内だけ保持する。保存する値を増やさないため、開き直すと自己負担に戻る。
  const [view, setView] = useState<ViewScope>('mine');

  // useLiveQuery は初回レンダーで undefined を返す(IndexedDB への問い合わせは非同期のため)。
  // ここで早期returnしないと、支出が存在する trip でも一瞬「集計する支出がまだありません。」
  // が表示されてしまう(HomeScreen.tsx と同じ理由・同じ対処)。
  if (expenses === undefined) {
    return (
      <div className="summary">
        <p className="empty">{t.common.loading}</p>
      </div>
    );
  }

  const fmt = (v: number) => formatWithCurrency(v, trip.homeCurrency);
  const list = expenses;
  const summary = summarize(list, trip);
  const categories = breakdownByCategory(list, trip, view);
  const days = dailySeries(list, trip, view);
  const viewTotalHome = categories.reduce((sum, c) => sum + c.home, 0);

  if (list.length === 0) {
    return <p className="empty">{t.summary.empty}</p>;
  }

  return (
    <div className="summary">
      <section>
        <h3>{t.home.total}</h3>
        <div className="card">
          <span className="card-jpy" data-testid="summary-total">
            {fmt(summary.totalHome)}
          </span>
          <span className="card-foreign">
            {formatWithCurrency(summary.totalMinor, trip.currency)} / {t.common.items(summary.count)}
          </span>
          <div className="card-split">
            <div>
              <span className="card-label">{t.scope.personal}</span>
              <span data-testid="summary-personal">{fmt(summary.personalHome)}</span>
            </div>
            <div>
              <span className="card-label">{t.scope.shared}</span>
              <span data-testid="summary-shared">{fmt(summary.sharedHome)}</span>
              <span className="card-sub" data-testid="summary-share-note">
                {t.home.myShare(fmt(summary.sharedPerPersonHome), trip.memberCount)}
              </span>
            </div>
          </div>
          <p className="card-sub">
            {t.summary.myTotal}{' '}
            <strong data-testid="summary-mine">{fmt(summary.myTotalHome)}</strong>
            {t.summary.myTotalNote}
          </p>
        </div>
      </section>

      <div className="segment">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={v === view ? 'seg active' : 'seg'}
            onClick={() => setView(v)}
          >
            {t.view[v]}
          </button>
        ))}
      </div>

      {categories.length === 0 ? (
        <p className="empty">{t.summary.viewEmpty(t.view[view])}</p>
      ) : (
        <>
          <section>
            <h3 className="chart-head">
              <span>{t.summary.byCategory}</span>
              <em data-testid="category-head-note">
                {t.view[view]} {fmt(viewTotalHome)}
              </em>
            </h3>
            <CategoryChart rows={categories} homeCurrency={trip.homeCurrency} />
          </section>

          <section>
            <h3 className="chart-head">
              <span>{t.summary.daily}</span>
              <em data-testid="daily-head-note">{t.view[view]}</em>
            </h3>
            <DailyChart series={days} homeCurrency={trip.homeCurrency} />
          </section>
        </>
      )}
    </div>
  );
}
