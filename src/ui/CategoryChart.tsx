import { categoryColor, categoryIcon } from '../domain/categories';
import { formatWithCurrency } from '../domain/money';
import type { CategoryBreakdown } from '../domain/summary';
import { useI18n } from '../i18n/LangContext';

/** 構成比の帯と、同じ色・同じ順の内訳リスト。色が凡例の役割を兼ねる。 */
export function CategoryChart({
  rows,
  homeCurrency,
}: {
  rows: CategoryBreakdown[];
  homeCurrency: string;
}) {
  const { t } = useI18n();
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
              {categoryIcon(r.category)} {t.category[r.category]}
            </span>
            <span className="legend-home">{formatWithCurrency(r.home, homeCurrency)}</span>
            <span className="legend-pct">{Math.round(r.ratio * 100)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}
