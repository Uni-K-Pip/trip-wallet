import { toIsoDate } from '../domain/date';
import type { Expense, Trip } from '../domain/types';
import { db } from './db';
import { migrateTrip } from './migrateTrip';

export type BackupPhoto = { id: string; type: string; dataBase64: string };

export type BackupFile = {
  format: 'trip-wallet-backup';
  version: 3;
  exportedAt: number;
  trips: Trip[];
  expenses: Expense[];
  photos: BackupPhoto[];
};

export type BackupErrorCode = 'invalid-json' | 'not-backup' | 'unsupported-version' | 'broken';

/** 取り込みの失敗理由。文言は画面側で言語に合わせて組み立てる。 */
export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    readonly detail?: string,
  ) {
    super(code);
    this.name = 'BackupError';
  }
}

export type ImportResult = { trips: number; expenses: number; photos: number };

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // String.fromCharCode の引数の数には上限があるので分割して詰める
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportBackup(): Promise<BackupFile> {
  const [trips, expenses, photos] = await Promise.all([
    db.trips.toArray(),
    db.expenses.toArray(),
    db.photos.toArray(),
  ]);

  return {
    format: 'trip-wallet-backup',
    version: 3,
    exportedAt: Date.now(),
    trips,
    expenses,
    photos: await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        type: p.blob.type || 'image/jpeg',
        dataBase64: await blobToBase64(p.blob),
      })),
    ),
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup);
}

/** 予算は v1〜v3 で名前が違う。どれも「数値または null、あるいは未設定」を許す。 */
function isBudgetField(v: unknown): boolean {
  return v === undefined || v === null || typeof v === 'number';
}

function isTrip(v: unknown): v is Trip {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.currency === 'string' &&
    typeof t.startDate === 'string' &&
    (t.endDate === null || typeof t.endDate === 'string') &&
    typeof t.currencyDecimals === 'number' &&
    typeof t.memberCount === 'number' &&
    isBudgetField(t.budgetJpy) &&
    isBudgetField(t.personalBudgetJpy) &&
    isBudgetField(t.sharedBudgetJpy) &&
    isBudgetField(t.personalBudgetHome) &&
    isBudgetField(t.sharedBudgetHome) &&
    // v1.0.4 以前のバックアップには換算先通貨が無い
    (t.homeCurrency === undefined || typeof t.homeCurrency === 'string') &&
    (t.homeCurrencyDecimals === undefined || typeof t.homeCurrencyDecimals === 'number')
  );
}

function isExpense(v: unknown): v is Expense {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.tripId === 'string' &&
    typeof e.date === 'string' &&
    typeof e.scope === 'string' &&
    typeof e.category === 'string' &&
    typeof e.payment === 'string' &&
    typeof e.amountMinor === 'number' &&
    typeof e.rate === 'number' &&
    (e.photoId === null || typeof e.photoId === 'string')
  );
}

function isBackupPhoto(v: unknown): v is BackupPhoto {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.type === 'string' && typeof p.dataBase64 === 'string';
}

export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('invalid-json');
  }

  if (typeof raw !== 'object' || raw === null) throw new BackupError('not-backup');
  const obj = raw as Record<string, unknown>;
  if (obj.format !== 'trip-wallet-backup') throw new BackupError('not-backup');

  // 書き出しは v3 だが、v1.0.2 以前が書いた v1 と v1.0.4 までの v2 も取り込めるようにする
  const version = obj.version;
  if (version !== 1 && version !== 2 && version !== 3) {
    throw new BackupError('unsupported-version', String(version));
  }
  if (!Array.isArray(obj.trips) || !Array.isArray(obj.expenses)) {
    throw new BackupError('broken');
  }
  const photos = Array.isArray(obj.photos) ? obj.photos : [];

  if (!obj.trips.every(isTrip) || !obj.expenses.every(isExpense) || !photos.every(isBackupPhoto)) {
    throw new BackupError('broken');
  }

  return {
    format: 'trip-wallet-backup',
    version: 3,
    exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : 0,
    trips: obj.trips.map((t) => migrateTrip(t as Record<string, unknown>)),
    expenses: obj.expenses as Expense[],
    photos: photos as BackupPhoto[],
  };
}

/** マージ方式。既存データは消さず、同じ id はインポート側で上書きする。 */
export async function importBackup(backup: BackupFile): Promise<ImportResult> {
  const photos = backup.photos.map((p) => ({
    id: p.id,
    blob: base64ToBlob(p.dataBase64, p.type),
  }));

  await db.transaction('rw', db.trips, db.expenses, db.photos, async () => {
    await db.trips.bulkPut(backup.trips);
    await db.expenses.bulkPut(backup.expenses);
    await db.photos.bulkPut(photos);
  });

  return {
    trips: backup.trips.length,
    expenses: backup.expenses.length,
    photos: photos.length,
  };
}

export function backupFileName(now: Date = new Date()): string {
  return `trip-wallet-${toIsoDate(now)}.json`;
}
