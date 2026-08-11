import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CategoryBreakdown } from '../domain/summary';
import { CategoryChart } from './CategoryChart';

const rows: CategoryBreakdown[] = [
  { category: 'food', home: 2816, ratio: 0.71 },
  { category: 'transport', home: 1150, ratio: 0.29 },
];

describe('CategoryChart', () => {
  it('帯の区画を構成比の幅とカテゴリ色で並べる', () => {
    render(<CategoryChart rows={rows} />);

    const segs = screen.getAllByTestId('stack-seg');
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveStyle({ width: '71%', backgroundColor: '#38bdf8' });
    expect(segs[1]).toHaveStyle({ width: '29%', backgroundColor: '#a78bfa' });
  });

  it('凡例を帯と同じ順・同じ色で並べる', () => {
    render(<CategoryChart rows={rows} />);

    const legend = screen.getAllByTestId('cat-row');
    expect(legend).toHaveLength(2);
    expect(legend[0]).toHaveTextContent('食事');
    expect(legend[0]).toHaveTextContent('¥2,816');
    expect(legend[0]).toHaveTextContent('71%');
    expect(legend[1]).toHaveTextContent('交通');
    expect(legend[1]).toHaveTextContent('¥1,150');
    expect(legend[1]).toHaveTextContent('29%');
    expect(screen.getAllByTestId('legend-dot')[1]).toHaveStyle({ backgroundColor: '#a78bfa' });
  });

  it('行が無ければ何も描かない', () => {
    const { container } = render(<CategoryChart rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
