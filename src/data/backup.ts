import { toIsoDate } from '../domain/date';
import type { Expense, Trip } from '../domain/types';
import { db } from './db';

export type BackupPhoto = { id: string; type: string; dataBase64: string };

export type BackupFile = {
  format: 'trip-wallet-backup';
  version: 1;
  exportedAt: number;
  trips: Trip[];
  expenses: Expense[];
  photos: BackupPhoto[];
};

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
    version: 1,
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
    (t.budgetJpy === null || typeof t.budgetJpy === 'number')
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
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('JSON として読み込めませんでした');
  }

  const b = json as Partial<BackupFile> | null;
  if (!b || b.format !== 'trip-wallet-backup') {
    throw new Error('Trip Wallet のバックアップファイルではありません');
  }
  if (b.version !== 1) {
    throw new Error(`対応していないバージョンです: ${String(b.version)}`);
  }
  if (!Array.isArray(b.trips) || !Array.isArray(b.expenses)) {
    throw new Error('バックアップの中身が壊れています');
  }
  const photos = Array.isArray(b.photos) ? b.photos : [];

  if (!b.trips.every(isTrip) || !b.expenses.every(isExpense) || !photos.every(isBackupPhoto)) {
    throw new Error('バックアップの中身が壊れています');
  }

  return {
    format: 'trip-wallet-backup',
    version: 1,
    exportedAt: typeof b.exportedAt === 'number' ? b.exportedAt : 0,
    trips: b.trips,
    expenses: b.expenses,
    photos,
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
