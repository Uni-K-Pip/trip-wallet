import type { Category, Payment, Scope } from './types';

export const CATEGORIES: { value: Category; icon: string; color: string }[] = [
  { value: 'food', icon: '🍜', color: '#38bdf8' },
  { value: 'transport', icon: '🚇', color: '#a78bfa' },
  { value: 'sightseeing', icon: '🎫', color: '#4ade80' },
  { value: 'shopping', icon: '🛍️', color: '#fbbf24' },
  { value: 'lodging', icon: '🏨', color: '#f472b6' },
  { value: 'other', icon: '📝', color: '#64748b' },
];

export const PAYMENTS: { value: Payment; icon: string }[] = [
  { value: 'cash', icon: '💴' },
  { value: 'mobile', icon: '📱' },
  { value: 'card', icon: '💳' },
];

export const SCOPES: Scope[] = ['personal', 'shared'];

export function categoryIcon(v: Category): string {
  return CATEGORIES.find((c) => c.value === v)?.icon ?? '📝';
}
export function categoryColor(v: Category): string {
  return CATEGORIES.find((c) => c.value === v)?.color ?? '#64748b';
}
