import { useLiveQuery } from 'dexie-react-hooks';
import { listExpenses } from '../data/expenseRepo';
import { categoryIcon, categoryLabel } from '../domain/categories';
import { formatDateLabel } from '../domain/date';
import { formatJpy, formatWithCurrency } from '../domain/money';
import { breakdownByCategory, summarize, totalsByDate } from '../domain/summary';
import type { Trip } from '../domain/types';

export function SummaryScreen({ trip }: { trip: Trip }) {
  const expenses = useLiveQuery(() => listExpenses(trip.id), [trip.id]);

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
  const categories = breakdownByCategory(list, trip, 'mine');
  const days = totalsByDate(list, trip);
  const maxDayJpy = days.reduce((max, d) => Math.max(max, d.jpy), 1);

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

      <section>
        <h3>カテゴリ別</h3>
        {categories.map((c) => (
          <div className="cat-row" data-testid="cat-row" key={c.category}>
            <span className="cat-row-name">
              {categoryIcon(c.category)} {categoryLabel(c.category)}
            </span>
            <div className="cat-bar">
              <div className="cat-fill" style={{ width: `${c.ratio * 100}%` }} />
            </div>
            <span className="cat-row-value">
              {formatJpy(c.jpy)} / {Math.round(c.ratio * 100)}%
            </span>
          </div>
        ))}
      </section>

      <section>
        <h3>日別推移</h3>
        {days.map((d) => (
          <div className="cat-row" data-testid="day-row" key={d.date}>
            <span className="cat-row-name">{formatDateLabel(d.date)}</span>
            <div className="cat-bar">
              <div className="cat-fill" style={{ width: `${(d.jpy / maxDayJpy) * 100}%` }} />
            </div>
            <span className="cat-row-value">{formatJpy(d.jpy)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
