import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Trip } from '../domain/types';
import { TripPickerSheet } from './TripPickerSheet';

function trip(id: string, name: string): Trip {
  return {
    id,
    name,
    currency: 'USD',
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

const trips = [trip('a', '上海 2026-09'), trip('b', 'NY 2026-09')];

describe('TripPickerSheet', () => {
  it('開いた時点では今の旅行が選ばれている', () => {
    render(
      <TripPickerSheet trips={trips} activeTripId="b" onSelect={() => {}} onClose={() => {}} />,
    );

    expect(screen.getByRole('option', { name: 'NY 2026-09' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('決定を押すと選んだ旅行の id を返す', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <TripPickerSheet trips={trips} activeTripId="a" onSelect={onSelect} onClose={() => {}} />,
    );

    await user.click(screen.getByRole('option', { name: 'NY 2026-09' }));
    await user.click(screen.getByRole('button', { name: '決定' }));

    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('選び直さずに決定を押すと今の旅行の id を返す', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <TripPickerSheet trips={trips} activeTripId="a" onSelect={onSelect} onClose={() => {}} />,
    );

    await user.click(screen.getByRole('button', { name: '決定' }));

    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('✕ で閉じると選択は伝えない', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <TripPickerSheet trips={trips} activeTripId="a" onSelect={onSelect} onClose={onClose} />,
    );

    await user.click(screen.getByRole('option', { name: 'NY 2026-09' }));
    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
