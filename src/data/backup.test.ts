import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { createTrip, listTrips } from './tripRepo';
import { addExpense, listExpenses } from './expenseRepo';
import { savePhoto, getPhoto } from './photoRepo';
import {
  blobToBase64,
  base64ToBlob,
  exportBackup,
  serializeBackup,
  parseBackup,
  importBackup,
  backupFileName,
  BackupError,
} from './backup';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('base64 変換', () => {
  it('Blob を往復させても中身が変わらない', async () => {
    const original = new Blob([new Uint8Array([0, 1, 254, 255, 128])], { type: 'image/jpeg' });
    const restored = base64ToBlob(await blobToBase64(original), 'image/jpeg');

    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(
      new Uint8Array(await original.arrayBuffer()),
    );
    expect(restored.type).toBe('image/jpeg');
  });
});

describe('backupFileName', () => {
  it('日付入りのファイル名にする', () => {
    expect(backupFileName(new Date(2026, 8, 16))).toBe('trip-wallet-2026-09-16.json');
  });
});

describe('exportBackup / importBackup', () => {
  async function seed() {
    const trip = await createTrip({
      name: '上海',
      currency: 'CNY',
      homeCurrency: 'JPY',
      personalBudgetHome: 100000,
      sharedBudgetHome: 30000,
    });
    const photoId = await savePhoto(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
    const expense = await addExpense({
      tripId: trip.id,
      date: '2026-09-12',
      amountMinor: 12000,
      scope: 'shared',
      category: 'food',
      payment: 'mobile',
      memo: '小籠包',
      rate: 23.465,
      rateSource: 'api',
      photoId,
    });
    return { trip, expense, photoId };
  }

  it('全旅行・全支出・全写真を 1 つの JSON にまとめる', async () => {
    const { trip, photoId } = await seed();
    const backup = await exportBackup();

    expect(backup.format).toBe('trip-wallet-backup');
    expect(backup.version).toBe(3);
    expect(backup.trips.map((t) => t.id)).toEqual([trip.id]);
    expect(backup.expenses).toHaveLength(1);
    expect(backup.photos.map((p) => p.id)).toEqual([photoId]);
    expect(backup.photos[0].type).toBe('image/jpeg');
  });

  it('エクスポート → 消去 → インポートで完全に復元される', async () => {
    const { trip, expense, photoId } = await seed();
    const text = serializeBackup(await exportBackup());

    await db.delete();
    await db.open();
    expect(await listTrips()).toEqual([]);

    const result = await importBackup(parseBackup(text));
    expect(result).toEqual({ trips: 1, expenses: 1, photos: 1 });

    const trips = await listTrips();
    expect(trips[0].id).toBe(trip.id);
    expect(trips[0].personalBudgetHome).toBe(100000);
    expect(trips[0].sharedBudgetHome).toBe(30000);

    const expenses = await listExpenses(trip.id);
    expect(expenses[0].id).toBe(expense.id);
    expect(expenses[0].memo).toBe('小籠包');
    expect(expenses[0].rate).toBe(23.465);

    const photo = await getPhoto(photoId);
    expect(new Uint8Array(await photo!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('既存データを消さずにマージする', async () => {
    const { trip } = await seed();
    const text = serializeBackup(await exportBackup());

    await db.delete();
    await db.open();
    const other = await createTrip({ name: '別の旅', currency: 'KRW', homeCurrency: 'JPY' });

    await importBackup(parseBackup(text));
    const ids = (await listTrips()).map((t) => t.id);
    expect(ids).toContain(other.id);
    expect(ids).toContain(trip.id);
  });

  it('同じ id はインポート側で上書きする', async () => {
    const { trip } = await seed();
    const text = serializeBackup(await exportBackup());

    await db.trips.update(trip.id, { name: '書き換え後' });
    await importBackup(parseBackup(text));

    expect((await db.trips.get(trip.id))?.name).toBe('上海');
  });
});

describe('parseBackup', () => {
  it('JSON でなければ例外', () => {
    expect(() => parseBackup('not json')).toThrow();
  });

  it('別形式のファイルは例外', () => {
    expect(() => parseBackup(JSON.stringify({ format: 'something-else' }))).toThrow();
  });

  it('未対応バージョンは例外', () => {
    expect(() =>
      parseBackup(JSON.stringify({ format: 'trip-wallet-backup', version: 99 })),
    ).toThrow();
  });

  it('v1 のバックアップを取り込むと旧予算が個別予算に入る', async () => {
    const parsed = parseBackup(
      JSON.stringify({
        format: 'trip-wallet-backup',
        version: 1,
        exportedAt: 0,
        trips: [
          {
            id: 't1',
            name: '上海',
            currency: 'CNY',
            currencyDecimals: 2,
            startDate: '2026-09-12',
            endDate: null,
            budgetJpy: 80000,
            memberCount: 1,
            createdAt: 0,
          },
        ],
        expenses: [],
      }),
    );
    expect(parsed.version).toBe(3);

    await importBackup(parsed);
    const trips = await listTrips();
    expect(trips[0].personalBudgetHome).toBe(80000);
    expect(trips[0].sharedBudgetHome).toBeNull();
    expect('budgetJpy' in trips[0]).toBe(false);
  });

  it('photos が無い古い形式は空配列として受け入れる', () => {
    const parsed = parseBackup(
      JSON.stringify({
        format: 'trip-wallet-backup',
        version: 1,
        exportedAt: 0,
        trips: [],
        expenses: [],
      }),
    );
    expect(parsed.photos).toEqual([]);
  });

  it('startDate を欠いた trip を含む JSON は例外', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: 'trip-wallet-backup',
          version: 1,
          exportedAt: 0,
          trips: [
            {
              id: 't1',
              name: '上海',
              currency: 'CNY',
              currencyDecimals: 2,
              // startDate が欠けている
              endDate: null,
              budgetJpy: null,
              memberCount: 1,
              createdAt: 0,
            },
          ],
          expenses: [],
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'broken' }));
  });

  it('amountMinor が文字列の expense を含む JSON は例外', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: 'trip-wallet-backup',
          version: 1,
          exportedAt: 0,
          trips: [],
          expenses: [
            {
              id: 'e1',
              tripId: 't1',
              date: '2026-09-12',
              amountMinor: '12000',
              scope: 'personal',
              category: 'food',
              payment: 'cash',
              memo: '',
              rate: 23.4,
              rateSource: 'api',
              photoId: null,
              createdAt: 0,
              updatedAt: 0,
            },
          ],
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'broken' }));
  });
});

describe('parseBackup のエラー', () => {
  it('JSON でなければ invalid-json', () => {
    expect(() => parseBackup('{')).toThrowError(
      expect.objectContaining({ code: 'invalid-json' }),
    );
  });

  it('形が違えば not-backup', () => {
    expect(() => parseBackup('{"foo":1}')).toThrowError(
      expect.objectContaining({ code: 'not-backup' }),
    );
  });

  it('未知のバージョンは unsupported-version とその値', () => {
    const err = (() => {
      try {
        parseBackup(
          '{"format":"trip-wallet-backup","version":9,"trips":[],"expenses":[],"photos":[]}',
        );
        return null;
      } catch (e) {
        return e as BackupError;
      }
    })();
    expect(err?.code).toBe('unsupported-version');
    expect(err?.detail).toBe('9');
  });

  it('中身が壊れていれば broken', () => {
    expect(() =>
      parseBackup(
        '{"format":"trip-wallet-backup","version":3,"trips":[{"id":1}],"expenses":[],"photos":[]}',
      ),
    ).toThrowError(expect.objectContaining({ code: 'broken' }));
  });
});

describe('parseBackup のバージョン互換', () => {
  it('v2 の旅行に換算先通貨を補う', () => {
    const json = JSON.stringify({
      format: 'trip-wallet-backup',
      version: 2,
      exportedAt: 0,
      trips: [
        {
          id: 't1',
          name: 'NY',
          currency: 'USD',
          currencyDecimals: 2,
          startDate: '2026-09-12',
          endDate: null,
          personalBudgetJpy: 50000,
          sharedBudgetJpy: null,
          memberCount: 1,
          createdAt: 0,
        },
      ],
      expenses: [],
      photos: [],
    });
    const parsed = parseBackup(json);
    expect(parsed.trips[0].homeCurrency).toBe('JPY');
    expect(parsed.trips[0].personalBudgetHome).toBe(50000);
  });

  it('書き出しは v3', () => {
    const json = serializeBackup({
      format: 'trip-wallet-backup',
      version: 3,
      exportedAt: 0,
      trips: [],
      expenses: [],
      photos: [],
    });
    expect(JSON.parse(json).version).toBe(3);
  });
});
