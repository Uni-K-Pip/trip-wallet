import type { Category, Payment, Scope } from './types';

export const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: 'food', label: '食事', icon: '🍜' },
  { value: 'transport', label: '交通', icon: '🚇' },
  { value: 'sightseeing', label: '観光', icon: '🎫' },
  { value: 'shopping', label: '買物', icon: '🛍️' },
  { value: 'lodging', label: '宿泊', icon: '🏨' },
  { value: 'other', label: 'その他', icon: '📝' },
];

export const PAYMENTS: { value: Payment; label: string; icon: string }[] = [
  { value: 'cash', label: '現金', icon: '💴' },
  { value: 'mobile', label: 'QR決済', icon: '📱' },
  { value: 'card', label: 'カード', icon: '💳' },
];

export const SCOPES: { value: Scope; label: string }[] = [
  { value: 'personal', label: '個別' },
  { value: 'shared', label: '共有' },
];

export function categoryLabel(v: Category): string {
  return CATEGORIES.find((c) => c.value === v)?.label ?? 'その他';
}

export function categoryIcon(v: Category): string {
  return CATEGORIES.find((c) => c.value === v)?.icon ?? '📝';
}

export function paymentLabel(v: Payment): string {
  return PAYMENTS.find((p) => p.value === v)?.label ?? '現金';
}

export function paymentIcon(v: Payment): string {
  return PAYMENTS.find((p) => p.value === v)?.icon ?? '💴';
}

export function scopeLabel(v: Scope): string {
  return SCOPES.find((s) => s.value === v)?.label ?? '個別';
}
