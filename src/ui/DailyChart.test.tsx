import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { eachDate } from '../domain/date';
import type { DailySeries } from '../domain/summary';
import { DailyChart } from './DailyChart';

const threeDays: DailySeries = {
  points: [
    { date: '2026-09-12', jpy: 2816 },
    { date: '2026-09-13', jpy: 0 },
    { date: '2026-09-14', jpy: 1150 },
  ],
  totalJpy: 3966,
  maxJpy: 2816,
  peakDate: '2026-09-12',
  averageJpy: 1322,
};

describe('DailyChart', () => {
  it('0 円の日にも棒と日付を出す', () => {
    render(<DailyChart series={threeDays} />);

    const cols = screen.getAllByTestId('day-col');
    expect(cols).toHaveLength(3);
    expect(cols[1]).toHaveAttribute('aria-label', '9/13(日) ¥0');
    expect(screen.getAllByTestId('day-label')).toHaveLength(3);
  });

  it('最高額の日と 0 円の日で棒の見た目を変える', () => {
    render(<DailyChart series={threeDays} />);

    const cols = screen.getAllByTestId('day-col');
    expect(cols[0].firstChild).toHaveClass('peak');
    expect(cols[1].firstChild).toHaveClass('zero');
    expect(cols[2].firstChild).not.toHaveClass('peak');
  });

  it('平均と最高を図の下に出す', () => {
    render(<DailyChart series={threeDays} />);

    expect(screen.getByTestId('daily-average')).toHaveTextContent('1日あたり平均 ¥1,322');
    expect(screen.getByTestId('daily-peak')).toHaveTextContent('最高 9/12(土) ¥2,816');
  });

  it('31 日分では日付ラベルを間引く', () => {
    const points = eachDate('2026-09-01', '2026-10-01').map((date) => ({ date, jpy: 1000 }));
    render(
      <DailyChart
        series={{
          points,
          totalJpy: 31000,
          maxJpy: 1000,
          peakDate: '2026-09-01',
          averageJpy: 1000,
        }}
      />,
    );

    expect(screen.getAllByTestId('day-col')).toHaveLength(31);
    // step = ceil(31 / 7) = 5 → 0, 5, 10, 15, 20, 25, 30 の 7 個
    expect(screen.getAllByTestId('day-label')).toHaveLength(7);
  });

  it('points が空なら何も描かない', () => {
    const { container } = render(
      <DailyChart
        series={{ points: [], totalJpy: 0, maxJpy: 0, peakDate: null, averageJpy: 0 }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
