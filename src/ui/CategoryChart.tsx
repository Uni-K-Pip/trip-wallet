import { categoryColor, categoryIcon, categoryLabel } from '../domain/categories';
import { formatJpy } from '../domain/money';
import type { CategoryBreakdown } from '../domain/summary';

/** 構成比の帯と、同じ色・同じ順の内訳リスト。色が凡例の役割を兼ねる。 */
export function CategoryChart({ rows }: { rows: CategoryBreakdown[] }) {
  if (rows.length === 0) return null;

  return (
    <>
      <div className="stack-bar">
        {rows.map((r) => (
          <span
            key={r.category}
            className="stack-seg"
            data-testid="stack-seg"
            style={{ width: `${Math.round(r.ratio * 100)}%`, backgroundColor: categoryColor(r.category) }}
          />
        ))}
      </div>
      <ul className="legend">
        {rows.map((r) => (
          <li className="legend-row" data-testid="cat-row" key={r.category}>
            <span
              className="legend-dot"
              data-testid="legend-dot"
              style={{ backgroundColor: categoryColor(r.category) }}
            />
            <span className="legend-name">
              {categoryIcon(r.category)} {categoryLabel(r.category)}
            </span>
            <span className="legend-jpy">{formatJpy(r.home)}</span>
            <span className="legend-pct">{Math.round(r.ratio * 100)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}
