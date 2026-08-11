import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listExpenses } from '../data/expenseRepo';
import { formatJpy, formatWithCurrency } from '../domain/money';
import { breakdownByCategory, dailySeries, summarize } from '../domain/summary';
import type { ViewScope } from '../domain/summary';
import type { Trip } from '../domain/types';
import { CategoryChart } from './CategoryChart';
import { DailyChart } from './DailyChart';

const VIEWS: { value: ViewScope; label: string }[] = [
  { value: 'personal', label: '個別' },
  { value: 'shared', label: '共有' },
  { value: 'mine', label: '自己負担' },
];

function viewLabel(v: ViewScope): string {
  return VIEWS.find((x) => x.value === v)?.label ?? '自己負担';
}

export function SummaryScreen({ trip }: { trip: Trip }) {
  const expenses = useLiveQuery(() => listExpenses(trip.id), [trip.id]);
  // 切り替えはセッション内だけ保持する。保存する値を増やさないため、開き直すと自己負担に戻る。
  const [view, setView] = useState<ViewScope>('mine');

  // useLiveQuery は初回レンダーで undefined を返す(IndexedDB への問い合わせは非同期のため)。
  // ここで早期returnしないと、支出が存在する trip でも一瞬「集計する支出がまだありません。」
  // が表示されてしまう(HomeScreen.tsx と同じ理由・同じ対処)。
  if (expenses === undefined) {
    return (
      <div className="summary">
        <p className="empty">読み込み中…</p>
      </div>
    );
  }

  const list = expenses;
  const summary = summarize(list, trip);
  const categories = breakdownByCategory(list, trip, view);
  const days = dailySeries(list, trip, view);
  const viewTotalJpy = categories.reduce((sum, c) => sum + c.jpy, 0);

  if (list.length === 0) {
    return <p className="empty">集計する支出がまだありません。</p>;
  }

  return (
    <div className="summary">
      <section>
        <h3>合計</h3>
        <div className="card">
          <span className="card-jpy" data-testid="summary-total">
            {formatJpy(summary.totalJpy)}
          </span>
          <span className="card-foreign">
            {formatWithCurrency(summary.totalMinor, trip.currency)} / {summary.count}件
          </span>
          <div className="card-split">
            <div>
              <span className="card-label">個別</span>
              <span data-testid="summary-personal">{formatJpy(summary.personalJpy)}</span>
            </div>
            <div>
              <span className="card-label">共有</span>
              <span data-testid="summary-shared">{formatJpy(summary.sharedJpy)}</span>
              <span className="card-sub" data-testid="summary-share-note">
                自分の負担 {formatJpy(summary.sharedPerPersonJpy)}({trip.memberCount}人)
              </span>
            </div>
          </div>
          <p className="card-sub">
            自分の負担合計:{' '}
            <strong data-testid="summary-mine">{formatJpy(summary.myTotalJpy)}</strong>
            (個別 + 共有の人数割り)
          </p>
        </div>
      </section>

      <div className="segment">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            className={v.value === view ? 'seg active' : 'seg'}
            onClick={() => setView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {categories.length === 0 ? (
        <p className="empty">{viewLabel(view)}の支出はまだありません。</p>
      ) : (
        <>
          <section>
            <h3 className="chart-head">
              <span>カテゴリ別</span>
              <em data-testid="category-head-note">
                {viewLabel(view)} {formatJpy(viewTotalJpy)}
              </em>
            </h3>
            <CategoryChart rows={categories} />
          </section>

          <section>
            <h3 className="chart-head">
              <span>日別推移</span>
              <em data-testid="daily-head-note">{viewLabel(view)}</em>
            </h3>
            <DailyChart series={days} />
          </section>
        </>
      )}
    </div>
  );
}
