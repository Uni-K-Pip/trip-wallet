import { describe, it, expect } from 'vitest';
import type { Trip } from '../domain/types';
import { pickActiveTrip } from './useActiveTrip';

function trip(id: string): Trip {
  return {
    id,
    name: id,
    currency: 'CNY',
    currencyDecimals: 2,
    homeCurrency: 'JPY',
    homeCurrencyDecimals: 0,
    startDate: '2026-09-12',
    endDate: null,
    personalBudgetHome: null,
    sharedBudgetHome: null,
    memberCount: 1,
    createdAt: 0,
  };
}

describe('pickActiveTrip', () => {
  it('保存された旅行を選ぶ', () => {
    expect(pickActiveTrip([trip('a'), trip('b')], 'b')?.id).toBe('b');
  });

  it('保存された旅行が消えていたら先頭に落とす', () => {
    expect(pickActiveTrip([trip('a'), trip('b')], 'zzz')?.id).toBe('a');
  });

  it('保存が無ければ先頭を選ぶ', () => {
    expect(pickActiveTrip([trip('a')], null)?.id).toBe('a');
  });

  it('旅行が 1 件も無ければ null', () => {
    expect(pickActiveTrip([], 'a')).toBeNull();
  });
});
