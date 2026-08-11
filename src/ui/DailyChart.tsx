import { dayOfMonth, formatDateLabel, weekdayIndex } from '../domain/date';
import { formatJpy } from '../domain/money';
import type { DailySeries } from '../domain/summary';
// Task 14 で useI18n の t に差し替える
import { ja } from '../i18n/ja';

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

export function DailyChart({ series }: { series: DailySeries }) {
  const { points, maxHome, peakDate, averageHome } = series;
  if (points.length === 0) return null;

  const step = labelStep(points.length);
  // 日数が多いと棒が潰れるので間隔を詰める。横スクロールはさせない。
  const gap = points.length >= 15 ? 2 : 6;
  const scale = Math.max(1, maxHome);

  return (
    <div className="daily">
      <div className="daily-bars" style={{ gap: `${gap}px`, height: `${BAR_HEIGHT}px` }}>
        {averageHome > 0 && (
          <div className="daily-avg" style={{ bottom: `${(averageHome / scale) * BAR_HEIGHT}px` }}>
            <span>平均 {formatJpy(averageHome)}</span>
          </div>
        )}
        {points.map((p) => (
          <div
            className="daily-col"
            data-testid="day-col"
            key={p.date}
            role="img"
            aria-label={`${formatDateLabel(p.date, ja.weekdays)} ${formatJpy(p.home)}`}
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
                {ja.weekdays[weekdayIndex(p.date)]}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="daily-foot">
        <span data-testid="daily-average">
          1日あたり平均 <b>{formatJpy(averageHome)}</b>
        </span>
        {maxHome > 0 && peakDate && (
          <span data-testid="daily-peak">
            最高 {formatDateLabel(peakDate, ja.weekdays)} <b>{formatJpy(maxHome)}</b>
          </span>
        )}
      </div>
    </div>
  );
}
