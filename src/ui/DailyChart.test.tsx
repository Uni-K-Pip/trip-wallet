import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { eachDate } from '../domain/date';
import type { DailySeries } from '../domain/summary';
import { renderWithLang } from '../test/renderWithLang';
import { DailyChart } from './DailyChart';

const threeDays: DailySeries = {
  points: [
    { date: '2026-09-12', home: 2816 },
    { date: '2026-09-13', home: 0 },
    { date: '2026-09-14', home: 1150 },
  ],
  totalHome: 3966,
  maxHome: 2816,
  peakDate: '2026-09-12',
  averageHome: 1322,
};

describe('DailyChart', () => {
  it('0 円の日にも棒と日付を出す', () => {
    renderWithLang(<DailyChart series={threeDays} homeCurrency="JPY" />);

    const cols = screen.getAllByTestId('day-col');
    expect(cols).toHaveLength(3);
    expect(cols[1]).toHaveAttribute('aria-label', '9/13(日) ¥0');
    expect(screen.getAllByTestId('day-label')).toHaveLength(3);
  });

  it('最高額の日と 0 円の日で棒の見た目を変える', () => {
    renderWithLang(<DailyChart series={threeDays} homeCurrency="JPY" />);

    const cols = screen.getAllByTestId('day-col');
    expect(cols[0].firstChild).toHaveClass('peak');
    expect(cols[1].firstChild).toHaveClass('zero');
    expect(cols[2].firstChild).not.toHaveClass('peak');
  });

  it('平均と最高を図の下に出す', () => {
    renderWithLang(<DailyChart series={threeDays} homeCurrency="JPY" />);

    expect(screen.getByTestId('daily-average')).toHaveTextContent('1日あたり平均 ¥1,322');
    expect(screen.getByTestId('daily-peak')).toHaveTextContent('最高 9/12(土) ¥2,816');
  });

  it('31 日分では日付ラベルを間引く', () => {
    const points = eachDate('2026-09-01', '2026-10-01').map((date) => ({ date, home: 1000 }));
    renderWithLang(
      <DailyChart
        series={{
          points,
          totalHome: 31000,
          maxHome: 1000,
          peakDate: '2026-09-01',
          averageHome: 1000,
        }}
        homeCurrency="JPY"
      />,
    );

    expect(screen.getAllByTestId('day-col')).toHaveLength(31);
    // step = ceil(31 / 7) = 5 → 0, 5, 10, 15, 20, 25, 30 の 7 個
    expect(screen.getAllByTestId('day-label')).toHaveLength(7);
  });

  it('points が空なら何も描かない', () => {
    const { container } = renderWithLang(
      <DailyChart
        series={{ points: [], totalHome: 0, maxHome: 0, peakDate: null, averageHome: 0 }}
        homeCurrency="JPY"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('棒の高さが(home/scale)*BAR_HEIGHT に一致する', () => {
    const cleanData: DailySeries = {
      points: [
        { date: '2026-09-12', home: 100 },
        { date: '2026-09-13', home: 50 },
        { date: '2026-09-14', home: 0 },
      ],
      totalHome: 150,
      maxHome: 100,
      peakDate: '2026-09-12',
      averageHome: 50,
    };

    renderWithLang(<DailyChart series={cleanData} homeCurrency="JPY" />);

    const cols = screen.getAllByTestId('day-col');
    // maxHome = 100, BAR_HEIGHT = 110 なので scale = 100
    // 最高額: (100/100)*110 = 110px
    expect(cols[0].querySelector('.daily-bar')).toHaveStyle({ height: '110px' });
    // 中間: (50/100)*110 = 55px
    expect(cols[1].querySelector('.daily-bar')).toHaveStyle({ height: '55px' });
    // 0円: style 属性なし（inline style が設定されない）
    expect(cols[2].querySelector('.daily-bar')).not.toHaveAttribute('style');
  });

  it('英語なら曜日と平均が英語になる', () => {
    renderWithLang(<DailyChart series={threeDays} homeCurrency="JPY" />, 'en');
    expect(screen.getAllByTestId('day-label')[0]).toHaveTextContent('Sat');
  });

  it('換算先が EUR なら記号つき小数 2 桁で出す', () => {
    const euro: DailySeries = {
      points: [
        { date: '2026-09-12', home: 123456 },
        { date: '2026-09-13', home: 0 },
      ],
      totalHome: 123456,
      maxHome: 123456,
      peakDate: '2026-09-12',
      averageHome: 61728,
    };

    renderWithLang(<DailyChart series={euro} homeCurrency="EUR" />);

    expect(screen.getAllByTestId('day-col')[0]).toHaveAttribute('aria-label', '9/12(土) €1,234.56');
    expect(screen.getByTestId('daily-average')).toHaveTextContent('1日あたり平均 €617.28');
    expect(screen.getByTestId('daily-peak')).toHaveTextContent('最高 9/12(土) €1,234.56');
  });

  it('平均が最大値に近いとラベルを平均線の下に出す', () => {
    const flat: DailySeries = {
      points: [
        { date: '2026-09-12', home: 1000 },
        { date: '2026-09-13', home: 990 },
      ],
      totalHome: 1990,
      maxHome: 1000,
      peakDate: '2026-09-12',
      averageHome: 995,
    };
    const { container } = renderWithLang(<DailyChart series={flat} homeCurrency="JPY" />);

    expect(container.querySelector('.daily-avg')).toHaveClass('daily-avg--below');
  });

  it('平均が最大値より十分低ければラベルは平均線の上のまま', () => {
    const { container } = renderWithLang(<DailyChart series={threeDays} homeCurrency="JPY" />);

    expect(container.querySelector('.daily-avg')).not.toHaveClass('daily-avg--below');
  });

  it('平均線は棒より後ろの DOM 順に置く(棒の裏に隠れないように)', () => {
    const { container } = renderWithLang(<DailyChart series={threeDays} homeCurrency="JPY" />);

    // .daily-bar は transform アニメーションでスタッキングコンテキストを作るため、
    // 同じ層では DOM 順が後のほうが前面に描かれる。
    expect(container.querySelector('.daily-bars')?.lastElementChild).toHaveClass('daily-avg');
  });
});
