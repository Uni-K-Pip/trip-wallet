import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryColor } from './categories';

describe('categoryColor', () => {
  it('カテゴリごとの色を返す', () => {
    expect(categoryColor('food')).toBe('#38bdf8');
    expect(categoryColor('lodging')).toBe('#f472b6');
    expect(categoryColor('other')).toBe('#64748b');
  });

  it('すべてのカテゴリに違う色がある', () => {
    const colors = CATEGORIES.map((c) => c.color);
    expect(new Set(colors).size).toBe(CATEGORIES.length);
  });
});
