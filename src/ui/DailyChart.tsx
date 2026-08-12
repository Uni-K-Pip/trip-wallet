import { dayOfMonth, formatDateLabel, weekdayIndex } from '../domain/date';
import { formatWithCurrency } from '../domain/money';
import type { DailySeries } from '../domain/summary';
import { useI18n } from '../i18n/LangContext';

const BAR_HEIGHT = 110;

/** 日付ラベルは 7 個くらいまでに間引く。長い旅行でも横スクロールさせないため。 */
function labelStep(days: number): number {
  return Math.max(1, Math.ceil(days / 7));
}

function tickClass(isoDate: string): string {
  const wd = weekdayIndex(isoDate);
  if (wd === 6) return 'daily-tick sat';
  if (wd === 0) return 'daily-tick sun';
  return 'daily-tick';
}

function barClass(home: number, isPeak: boolean): string {
  if (home === 0) return 'daily-bar zero';
  return isPeak ? 'daily-bar peak' : 'daily-bar';
}

export function DailyChart({ series, homeCurrency }: { series: DailySeries; homeCurrency: string }) {
  const { t } = useI18n();
  const { points, maxHome, peakDate, averageHome } = series;
  if (points.length === 0) return null;

  const fmt = (v: number) => formatWithCurrency(v, homeCurrency);
  const step = labelStep(points.length);
  // 日数が多いと棒が潰れるので間隔を詰める。横スクロールはさせない。
  const gap = points.length >= 15 ? 2 : 6;
  const scale = Math.max(1, maxHome);

  return (
    <div className="daily">
      <div className="daily-bars" style={{ gap: `${gap}px`, height: `${BAR_HEIGHT}px` }}>
        {averageHome > 0 && (
          <div className="daily-avg" style={{ bottom: `${(averageHome / scale) * BAR_HEIGHT}px` }}>
            <span>{t.summary.average(fmt(averageHome))}</span>
          </div>
        )}
        {points.map((p) => (
          <div
            className="daily-col"
            data-testid="day-col"
            key={p.date}
            role="img"
            aria-label={`${formatDateLabel(p.date, t.weekdays)} ${fmt(p.home)}`}
          >
            <span
              className={barClass(p.home, p.date === peakDate && maxHome > 0)}
              style={p.home === 0 ? undefined : { height: `${(p.home / scale) * BAR_HEIGHT}px` }}
            />
          </div>
        ))}
      </div>

      <div className="daily-axis" style={{ gap: `${gap}px` }}>
        {points.map((p, i) => (
          <span className={tickClass(p.date)} key={p.date}>
            {i % step === 0 && (
              <span data-testid="day-label">
                {dayOfMonth(p.date)}
                <br />
                {t.weekdays[weekdayIndex(p.date)]}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="daily-foot">
        <span data-testid="daily-average">
          {t.summary.dailyAverage} <b>{fmt(averageHome)}</b>
        </span>
        {maxHome > 0 && peakDate && (
          <span data-testid="daily-peak">
            {t.summary.peak} {formatDateLabel(peakDate, t.weekdays)} <b>{fmt(maxHome)}</b>
          </span>
        )}
      </div>
    </div>
  );
}
