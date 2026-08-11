import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ChangeEvent } from 'react';
import {
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
} from '../data/backup';
import { countCachedRates } from '../data/rateCacheRepo';
import { deleteTrip } from '../data/tripRepo';
import { formatDateLabel } from '../domain/date';
import { formatJpy } from '../domain/money';
import type { Trip } from '../domain/types';
import { Sheet } from './Sheet';
import { TripForm } from './TripForm';

type Props = {
  trips: Trip[];
  activeTrip: Trip | null;
  onSelectTrip: (id: string) => void;
};

export function SettingsScreen({ trips, activeTrip, onSelectTrip }: Props) {
  const [editing, setEditing] = useState<Trip | 'new' | null>(null);
  const [message, setMessage] = useState('');
  const rateCount = useLiveQuery(() => countCachedRates(), [], 0);

  async function handleExport() {
    try {
      const json = serializeBackup(await exportBackup());
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      // revokeObjectURL を click() の直後に呼ぶと、ブラウザによってはダウンロード
      // 開始前に URL が無効化されてしまうことがあるため、次のタスクまで遅らせる
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage('バックアップを書き出しました');
    } catch {
      setMessage('書き出せませんでした');
    }
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを選び直せるようにする
    if (!file) return;

    try {
      const result = await importBackup(parseBackup(await file.text()));
      setMessage(`旅行 ${result.trips} 件・支出 ${result.expenses} 件を取り込みました`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '取り込みに失敗しました');
    }
  }

  async function handleDelete(trip: Trip) {
    if (!confirm(`「${trip.name}」と、その支出をすべて削除します。よろしいですか?`)) return;
    await deleteTrip(trip.id);
    setMessage(`「${trip.name}」を削除しました`);
  }

  return (
    <div className="settings">
      <section>
        <div className="section-head">
          <h3>旅行</h3>
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            追加
          </button>
        </div>

        {trips.length === 0 && <p className="empty">旅行がまだありません。「追加」から作成してください。</p>}

        <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.id} className={trip.id === activeTrip?.id ? 'trip active' : 'trip'}>
              <button type="button" className="trip-main" onClick={() => onSelectTrip(trip.id)}>
                <span className="trip-name">{trip.name}</span>
                <span className="trip-meta">
                  {trip.currency} / {formatDateLabel(trip.startDate)}
                  {trip.endDate ? `〜${formatDateLabel(trip.endDate)}` : ''} / {trip.memberCount}人
                  {trip.personalBudgetJpy !== null
                    ? ` / 予算 ${formatJpy(trip.personalBudgetJpy)}`
                    : ''}
                </span>
              </button>
              <button type="button" className="btn-ghost" onClick={() => setEditing(trip)}>
                編集
              </button>
              <button type="button" className="btn-danger" onClick={() => handleDelete(trip)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>データ</h3>
        <p className="hint">
          端末内にだけ保存されます。ブラウザのデータを消すと失われるので、旅行のあとは書き出しておいてください。
        </p>
        <div className="form-actions">
          <button type="button" className="btn-primary" onClick={handleExport}>
            バックアップを書き出す
          </button>
          <label className="btn-ghost file-label">
            取り込む
            <input type="file" accept="application/json" onChange={handleImport} />
          </label>
        </div>
        <p className="hint">取り込みは追加(マージ)です。同じ記録があればファイル側で上書きします。</p>
      </section>

      <section>
        <h3>レートキャッシュ</h3>
        <p className="hint">保存済み {rateCount ?? 0} 件。オフライン時はここから直近のレートを使います。</p>
      </section>

      {message !== '' && <p className="toast">{message}</p>}

      {editing !== null && (
        <Sheet
          title={editing === 'new' ? '旅行を追加' : '旅行を編集'}
          onClose={() => setEditing(null)}
        >
          <TripForm
            trip={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </Sheet>
      )}
    </div>
  );
}
