import type { Expense } from '../domain/types';
import { db, newId } from './db';

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

export async function addExpense(input: ExpenseInput): Promise<Expense> {
  const now = Date.now();
  const expense: Expense = { ...input, id: newId(), createdAt: now, updatedAt: now };
  await db.expenses.add(expense);
  return expense;
}

export async function updateExpense(id: string, patch: Partial<ExpenseInput>): Promise<void> {
  await db.expenses.update(id, { ...patch, updatedAt: Date.now() });
}

/** 写真も一緒に消す。写真だけ残しても参照元が無い。 */
export async function deleteExpense(id: string): Promise<void> {
  await db.transaction('rw', db.expenses, db.photos, async () => {
    const expense = await db.expenses.get(id);
    if (!expense) return;
    if (expense.photoId) await db.photos.delete(expense.photoId);
    await db.expenses.delete(id);
  });
}

export function getExpense(id: string): Promise<Expense | undefined> {
  return db.expenses.get(id);
}

/** 日付の新しい順。同じ日なら登録の新しい順。 */
export async function listExpenses(tripId: string): Promise<Expense[]> {
  const rows = await db.expenses.where('tripId').equals(tripId).toArray();
  return rows.sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date),
  );
}

export function countExpenses(tripId: string): Promise<number> {
  return db.expenses.where('tripId').equals(tripId).count();
}
