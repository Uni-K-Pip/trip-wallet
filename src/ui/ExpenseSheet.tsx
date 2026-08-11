import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { addExpense, updateExpense } from '../data/expenseRepo';
import { deletePhoto, savePhoto } from '../data/photoRepo';
import { CATEGORIES, PAYMENTS, SCOPES } from '../domain/categories';
import { currencySymbol } from '../domain/currency';
import { formatDateLabel, todayLocal } from '../domain/date';
import { formatJpy, minorToMajor, parseMajorToMinor, toJpy } from '../domain/money';
import type { Category, Expense, Payment, RateSource, Scope, Trip } from '../domain/types';
import { compressImage } from '../media/compressImage';
import { resolveRate } from '../rates/resolveRate';
import { Numpad } from './Numpad';
import { Sheet } from './Sheet';

// 手動で入れたレートは同じ旅行の次回入力の初期値として引き継ぐ
function manualRateKey(tripId: string): string {
  return `trip-wallet:manual-rate:${tripId}`;
}

function readManualRate(tripId: string): number | null {
  try {
    const raw = localStorage.getItem(manualRateKey(tripId));
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function storeManualRate(tripId: string, rate: number): void {
  try {
    localStorage.setItem(manualRateKey(tripId), String(rate));
  } catch {
    // 保存できなくても入力は続けられる
  }
}

/** 1 件ずつ deletePhoto する。途中で失敗しても残りは試み、呼び出し元の処理は妨げない。 */
async function deletePhotosBestEffort(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await deletePhoto(id);
    } catch {
      // 写真の後始末が失敗しても、支出の保存や画面遷移は止めない
    }
  }
}

type AutoRate = { rate: number; source: RateSource; note: string; stale: boolean };

type Props = {
  trip: Trip;
  expense?: Expense;
  onClose: (message?: string) => void;
};

export function ExpenseSheet({ trip, expense, onClose }: Props) {
  const decimals = trip.currencyDecimals;
  const symbol = currencySymbol(trip.currency);

  const [amount, setAmount] = useState(
    expense ? minorToMajor(expense.amountMinor, decimals).toFixed(decimals) : '',
  );
  const [date, setDate] = useState(expense?.date ?? todayLocal());
  const [scope, setScope] = useState<Scope>(expense?.scope ?? 'personal');
  const [category, setCategory] = useState<Category>(expense?.category ?? 'food');
  const [payment, setPayment] = useState<Payment>(expense?.payment ?? 'cash');
  const [memo, setMemo] = useState(expense?.memo ?? '');
  const [photoId, setPhotoId] = useState<string | null>(expense?.photoId ?? null);
  const [photoFile, setPhotoFile] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // 差し替えで役目を終えた写真の id を、支出レコードの保存が確定するまで貯めておく。
  // handleSave の呼び出しのたびに photoId から作り直すと、1 回目の savePhoto 成功で
  // state が新 id に進んでしまい、失敗→再試行のときに本当の旧 id を見失う。
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  // 開いた時点で支出レコードが実際に参照していた photoId。キャンセル時に
  // 「まだディスク上の支出が参照している写真」を誤って消さないための判定に使う。値は変えない。
  const initialPhotoIdRef = useRef(expense?.photoId ?? null);

  const [autoRate, setAutoRate] = useState<AutoRate | null>(
    expense && expense.rateSource !== 'manual'
      ? { rate: expense.rate, source: expense.rateSource, note: '記録時のレート', stale: false }
      : null,
  );
  const [autoLoaded, setAutoLoaded] = useState(expense !== undefined);
  const [manualRate, setManualRate] = useState<number | null>(
    expense
      ? expense.rateSource === 'manual'
        ? expense.rate
        : null
      : readManualRate(trip.id),
  );
  // 引き継いだ手動レートは、この画面で入れた値と違って「いつ入れた値か」が画面から
  // 分からない。機内モードのように自動取得できない場面では何日も前の値をそのまま
  // 使っていることに気づけないので、引き継ぎであることを表示で区別する。
  const [manualCarriedOver, setManualCarriedOver] = useState(
    expense === undefined && readManualRate(trip.id) !== null,
  );
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');

  // 保存済みのレートは焼き付いた値を保つ。日付を変えたときだけ取り直す。
  const keepSavedRate = expense !== undefined && date === expense.date;

  // レート解決は依存が変わったときしか走らないので、圏外や機内モードのまま直近
  // キャッシュに落ちると、通信が戻っても古いレートを表示し続けてしまう。復帰を
  // 拾って取り直す。手動レートを使っている間は下の effect が先に return するため、
  // 復帰しても勝手に上書きされることはない。
  const [onlineRetry, setOnlineRetry] = useState(0);
  useEffect(() => {
    const retry = () => setOnlineRetry((n) => n + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    if (manualRate !== null || keepSavedRate) return;
    let cancelled = false;
    void resolveRate(trip.currency, trip.homeCurrency, date).then((r) => {
      if (cancelled) return;
      setAutoLoaded(true);
      setAutoRate(
        r === null
          ? null
          : {
              rate: r.rate,
              source: r.source,
              note: r.stale
                ? `${formatDateLabel(r.effectiveDate)}時点のレートを使用中`
                : `${formatDateLabel(r.effectiveDate)}のレート`,
              stale: r.stale,
            },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [trip.currency, trip.homeCurrency, date, manualRate, keepSavedRate, onlineRetry]);

  const rate = manualRate ?? autoRate?.rate ?? null;
  const rateSource: RateSource = manualRate !== null ? 'manual' : (autoRate?.source ?? 'api');
  // 注記と警告色は、いま実際に使っているレートに合わせる。手動レートを使っている
  // ときに自動レートの stale を見せると、どちらの話なのか分からなくなる。
  const manualNote = manualCarriedOver ? '前回入力した手動レート' : '手動';
  const rateNote = manualRate !== null ? manualNote : (autoRate?.note ?? '');
  const rateStale = manualRate !== null ? manualCarriedOver : (autoRate?.stale ?? false);
  const amountMinor = parseMajorToMinor(amount, decimals);
  const jpy = rate === null ? null : toJpy(amountMinor, decimals, rate);

  function confirmRate() {
    const n = Number(rateInput);
    if (!Number.isFinite(n) || n <= 0) {
      setError('レートは 0 より大きい数で入力してください');
      return;
    }
    setManualRate(n);
    setManualCarriedOver(false);
    setEditingRate(false);
    setError('');
  }

  function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    setPhotoFile(file);
  }

  async function handleSave() {
    if (amountMinor <= 0) {
      setError('金額を入力してください');
      return;
    }
    if (rate === null || rate <= 0) {
      setError('レートを入力してください');
      return;
    }

    setSaving(true);
    // 写真の失敗で支出そのものを失わないよう、写真は独立して扱う
    let nextPhotoId = photoId;
    // このターンで役目を終える写真 id(差し替えで置き換わる旧 id)を積む先。
    // 支出レコードの保存が確定してから消すので、まずはローカル変数に集める。
    let queuedDeleteIds = pendingDeleteIds;
    let warning = '';
    if (photoFile) {
      try {
        nextPhotoId = await savePhoto(await compressImage(photoFile));
        // 差し替えに成功した写真だけ確定として扱う。ここで state を更新しておかないと
        // 保存失敗後の再試行で同じ写真をもう一度圧縮・保存してしまう(二重保存の原因)
        if (photoId !== null && photoId !== nextPhotoId) {
          queuedDeleteIds = [...queuedDeleteIds, photoId];
          setPendingDeleteIds(queuedDeleteIds);
        }
        setPhotoId(nextPhotoId);
        setPhotoFile(null);
      } catch (e) {
        // 容量超過は原因が分かるように文言を分ける。どちらの場合も写真だけ諦めて支出は保存する
        const quota = e instanceof DOMException && e.name === 'QuotaExceededError';
        warning = quota
          ? '端末の空き容量が足りず、写真なしで保存しました'
          : '写真は保存できませんでした';
      }
    }

    try {
      const input = {
        tripId: trip.id,
        date,
        amountMinor,
        scope,
        category,
        payment,
        memo: memo.trim(),
        rate,
        rateSource,
        photoId: nextPhotoId,
      };
      if (expense) await updateExpense(expense.id, input);
      else await addExpense(input);
      // 支出レコードが新しい写真を指すようになったと確定してから、
      // それまでに積んだ旧写真をまとめて消す。順序を逆にすると、この
      // addExpense/updateExpense が失敗したときに旧写真だけ消えてしまい、
      // DB 上の支出が参照する photoId の Photo が存在しない状態になる。
      if (queuedDeleteIds.length > 0) {
        await deletePhotosBestEffort(queuedDeleteIds);
        setPendingDeleteIds([]);
      }
      if (manualRate !== null) storeManualRate(trip.id, manualRate);
      setSaving(false);
      onClose(warning === '' ? '保存しました' : warning);
    } catch {
      setError('保存できませんでした');
      setSaving(false);
    }
  }

  // 再試行せずにシートを離れるとき、その回に savePhoto 済みだが支出レコードには
  // まだ反映されていない写真(=キャンセル時点の photoId が、開いた時点で支出が
  // 参照していた写真と違う場合のその photoId)と、それより前の差し替えで既に
  // 積まれている pendingDeleteIds を後始末する。ただし、開いた時点で支出が
  // 実際に参照していた写真(initialPhotoIdRef.current)だけは、保存が確定して
  // いない以上まだ現役の写真なので、絶対に消してはいけない。
  async function handleClose() {
    // 保存の実行中は閉じない。savePhoto は済んだが addExpense/updateExpense が
    // まだ飛行中、という窓でここを通すと、直後に保存が成功する支出が参照する
    // 写真(commit 待ちの新写真)を先に消してしまい、参照切れかつ復元不能になる。
    // onClose の二重呼び出し(handleClose と handleSave 成功時)もここで防ぐ。
    // 保存が失敗しても成功しても handleSave 側で saving を false に戻してから
    // onClose を呼ぶので、ユーザーがシートを閉じられなくなることはない。
    // setSaving(false) と onClose() は同じ同期ブロック内で呼ばれるため、
    // その間にこの handleClose が割り込んで二重に onClose が呼ばれることもない。
    if (saving) return;

    const initial = initialPhotoIdRef.current;
    const orphaned = pendingDeleteIds.filter((id) => id !== initial);
    if (photoId !== null && photoId !== initial && !orphaned.includes(photoId)) {
      orphaned.push(photoId);
    }
    if (orphaned.length > 0) {
      await deletePhotosBestEffort(orphaned);
    }
    onClose();
  }

  return (
    <Sheet title={expense ? '支出を編集' : '支出を追加'} onClose={() => void handleClose()}>
      <div className="amount-display">
        <span className="amount-major">
          {amount === '' ? '0' : amount}
          {symbol}
        </span>
        <span className="amount-jpy" data-testid="jpy-preview">
          {jpy === null ? 'レート未設定' : formatJpy(jpy)}
        </span>
      </div>

      <div className="rate-row">
        {editingRate ? (
          <>
            <label htmlFor="rate-input">{`1${symbol} = ? 円`}</label>
            <input
              id="rate-input"
              inputMode="decimal"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
            />
            <button type="button" className="btn-primary" onClick={confirmRate}>
              レートを確定
            </button>
          </>
        ) : (
          <>
            <span className={rateStale ? 'rate-note stale' : 'rate-note'}>
              {rate === null
                ? autoLoaded
                  ? 'レートを取得できません。手動で入力してください'
                  : 'レートを取得中…'
                : `1${symbol} = ${rate}円(${rateNote})`}
            </span>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setRateInput(rate === null ? '' : String(rate));
                setEditingRate(true);
              }}
            >
              レートを編集
            </button>
            {manualRate !== null && (
              <button type="button" className="btn-ghost" onClick={() => setManualRate(null)}>
                自動に戻す
              </button>
            )}
          </>
        )}
      </div>

      <Numpad value={amount} decimals={decimals} onChange={setAmount} />

      <div className="segment">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            className={s.value === scope ? 'seg active' : 'seg'}
            onClick={() => setScope(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="category-grid">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={c.value === category ? 'cat active' : 'cat'}
            onClick={() => setCategory(c.value)}
          >
            <span className="cat-icon">{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="chips">
        {PAYMENTS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={p.value === payment ? 'chip active' : 'chip'}
            onClick={() => setPayment(p.value)}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      <div className="form">
        <label htmlFor="expense-memo">メモ</label>
        <input
          id="expense-memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="店名・内容"
        />

        <label htmlFor="expense-date">日付</label>
        <input
          id="expense-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <label className="btn-ghost file-label">
          {photoFile || photoId ? 'レシート写真: あり(撮り直す)' : 'レシート写真を撮る'}
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
        </label>
      </div>

      {error !== '' && <p className="error">{error}</p>}

      <div className="form-actions">
        {/* 保存中は閉じられない(handleClose 側でも弾く)ことを見た目でも伝える */}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void handleClose()}
          disabled={saving}
        >
          キャンセル
        </button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
          保存
        </button>
      </div>
    </Sheet>
  );
}
