# 旅行支出管理 PWA(Trip Wallet)実装計画

**Goal:** 外貨で使った金額をスマホから入力し、その日の為替レートで日本円に換算して旅行単位で記録・集計するオフライン対応 PWA を作る。

**Architecture:** 計算ロジック(`src/domain`)を純粋関数として UI から完全に切り離し、ブラウザなしでテストする。永続化は Dexie(IndexedDB)で、リポジトリ層(`src/data`)が唯一の DB アクセス経路になる。為替レートは `src/rates` が「キャッシュ → Frankfurter → er-api → 直近キャッシュ → 手動」の順に解決し、解決した値は支出レコードに焼き付ける。UI(`src/ui`)は状態を持たず、`useLiveQuery` で DB を直接購読する。

**Tech Stack:** Vite / React 19 / TypeScript / Dexie 4 / vite-plugin-pwa / Vitest + jsdom + fake-indexeddb + @testing-library/react

## Global Constraints

- 対象仕様は `docs/dev/specs/2026-08-09-trip-expense-pwa-design.md`。判断に迷ったら仕様書が優先。
- リポジトリルートは `C:\Users\kohei\Downloads\trip-wallet`。この計画中のパスはすべてルートからの相対パス。
- 作業ブランチは `feature/trip-wallet`。`main` には触らない(`main` はリリース版専用)。
- UI 文言・コードコメント・コミットメッセージはすべて日本語で書く。
- **外貨金額は必ず最小単位の整数(`amountMinor`)で保持する。** 外貨を浮動小数で持つフィールドや変数を新設しない。
- **円換算は `toJpy()` だけを使う。** 各所に `amount * rate` を直接書かない。
- **レートは支出保存時に `Expense.rate` へ焼き付ける。** 表示・集計のたびに再取得・再計算しない。
- 外部通信は `fetch` のみ。API キーが必要な API・有料 API は使わない。
- 対応通貨は `src/domain/currency.ts` の `CURRENCIES` に限定する。Frankfurter は ECB 参照レートのため TWD・VND 等は取得できない。追加しない。
- 各タスクは TDD で進める: 失敗するテストを書く → 実行して失敗を確認 → 最小実装 → 通過を確認 → コミット。
- コミットメッセージは Conventional Commits(`feat:` / `test:` / `fix:` / `chore:` / `docs:`)。
- 全タスク完了時点で `npm run test` と `npm run build` の両方が通ること。

## File Structure

| パス | 責務 |
|---|---|
| `src/domain/types.ts` | ドメイン型の定義(Trip / Expense / Photo / RateCache) |
| `src/domain/date.ts` | ローカル日付の生成・整形 |
| `src/domain/currency.ts` | 対応通貨表と小数桁数 |
| `src/domain/money.ts` | 最小単位 ⇄ 表示単位の変換、円換算、金額整形 |
| `src/domain/categories.ts` | カテゴリ・支払い方法のラベルとアイコン |
| `src/domain/summary.ts` | 合計・個別/共有・予算残額・カテゴリ別・日別の集計 |
| `src/data/db.ts` | Dexie スキーマ定義 |
| `src/data/tripRepo.ts` | Trip の CRUD |
| `src/data/expenseRepo.ts` | Expense の CRUD |
| `src/data/photoRepo.ts` | Photo の保存・取得・削除 |
| `src/data/rateCacheRepo.ts` | レートキャッシュの読み書き |
| `src/data/backup.ts` | 全データの JSON エクスポート/インポート |
| `src/rates/frankfurter.ts` | Frankfurter クライアント |
| `src/rates/erApi.ts` | open.er-api.com クライアント(当日のみ) |
| `src/rates/resolveRate.ts` | レート解決のフォールバック手順 |
| `src/media/compressImage.ts` | 写真の縮小・JPEG 圧縮 |
| `src/app/App.tsx` | 画面切り替えとアプリシェル |
| `src/app/useActiveTrip.ts` | 現在の旅行の保持と切り替え |
| `src/app/pwa.ts` | Service Worker 更新検知とストレージ永続化 |
| `src/app/reminders.ts` | 旅行終了後のエクスポート促し判定 |
| `src/ui/HomeScreen.tsx` | サマリー + 日付別リスト + FAB |
| `src/ui/ExpenseSheet.tsx` | 支出の入力/編集シート |
| `src/ui/Numpad.tsx` | 自前テンキー |
| `src/ui/Sheet.tsx` | ボトムシートの外枠(共通) |
| `src/ui/SummaryScreen.tsx` | 集計画面 |
| `src/ui/SettingsScreen.tsx` | 旅行管理・エクスポート/インポート |
| `src/ui/TripForm.tsx` | 旅行の作成/編集フォーム |
| `src/main.tsx` | エントリポイント。当日レートの先読み |
| `src/styles.css` | 全画面共通のスタイル(CSS 変数 + クラス) |
| `src/vite-env.d.ts` | Vite / vite-plugin-pwa の型参照 |
| `src/test/setup.ts` | Vitest のセットアップ(fake-indexeddb、jest-dom) |
| `public/icon.svg` | アイコンの元データ |
| `scripts/generate-icons.mjs` | icon.svg から PWA 用 PNG を生成 |
| `vite.config.ts` | Vite / Vitest / vite-plugin-pwa の設定 |
| `.github/workflows/deploy.yml` | GitHub Pages への自動デプロイ |
| `README.md` | 概要・開発手順・手動確認チェックリスト |

---

### Task 1: プロジェクト初期化とテスト基盤、日付ユーティリティ

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/styles.css`, `src/test/setup.ts`
- Create: `src/domain/date.ts`
- Test: `src/domain/date.test.ts`

**Interfaces:**
- Consumes: なし(最初のタスク)
- Produces:
  - `todayLocal(now?: Date): string` — `"2026-09-12"`
  - `toIsoDate(d: Date): string`
  - `parseIsoDate(isoDate: string): Date`
  - `formatDateLabel(isoDate: string): string` — `"9/12(土)"`
  - `addDays(isoDate: string, days: number): string`
  - npm スクリプト: `npm run dev` / `npm run build` / `npm run test` / `npm run lint`

- [ ] **Step 1: `package.json` を作る**

`package.json`:

```json
{
  "name": "trip-wallet",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: 依存をインストールする**

```bash
npm install react react-dom dexie dexie-react-hooks
```

```bash
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest jsdom fake-indexeddb @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: TypeScript と Vite の設定を書く**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`(`vitest/config` の `defineConfig` を使うと `test` フィールドに型が付く):

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages のサブディレクトリ配信に合わせる。dev も同じパスになる。
  base: '/trip-wallet/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
// IndexedDB を jsdom に生やす。data 層のテストで使う。
import 'fake-indexeddb/auto';
```

- [ ] **Step 4: アプリの入口を作る**

`index.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <title>Trip Wallet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/app/App.tsx`(Task 8 で本実装に差し替える):

```tsx
export function App() {
  return <main>Trip Wallet</main>;
}
```

`src/styles.css`:

```css
:root {
  --bg: #0f172a;
  --surface: #1e293b;
  --surface-2: #334155;
  --text: #f1f5f9;
  --text-dim: #94a3b8;
  --accent: #38bdf8;
  --danger: #f87171;
  --ok: #4ade80;
  --radius: 14px;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  /* iOS のホーム画面起動時にセーフエリアへ潜り込まないようにする */
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}

button {
  font: inherit;
  color: inherit;
  border: none;
  background: none;
  cursor: pointer;
}
```

- [ ] **Step 5: 失敗するテストを書く**

`src/domain/date.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { todayLocal, toIsoDate, parseIsoDate, formatDateLabel, addDays } from './date';

describe('todayLocal', () => {
  it('UTC ではなく端末ローカルの日付を返す', () => {
    // ローカル 9/12 00:30。UTC に変換すると 9/11 になる地域があるため
    expect(todayLocal(new Date(2026, 8, 12, 0, 30))).toBe('2026-09-12');
  });

  it('月日を 0 埋めする', () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('toIsoDate / parseIsoDate', () => {
  it('往復して同じ日付になる', () => {
    expect(toIsoDate(parseIsoDate('2026-09-12'))).toBe('2026-09-12');
  });

  it('parseIsoDate はローカル時刻の 0 時を返す', () => {
    const d = parseIsoDate('2026-09-12');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });
});

describe('formatDateLabel', () => {
  it('曜日つきの短い表記にする', () => {
    expect(formatDateLabel('2026-09-12')).toBe('9/12(土)');
  });

  it('1 桁の月日をそのまま表示する', () => {
    expect(formatDateLabel('2026-01-05')).toBe('1/5(月)');
  });
});

describe('addDays', () => {
  it('月をまたぐ', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('負の日数で戻る', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });
});
```

- [ ] **Step 6: 実行して失敗を確認する**

```bash
npm run test
```

期待: `Failed to resolve import "./date"` で失敗する。

- [ ] **Step 7: 実装する**

`src/domain/date.ts`:

```ts
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** Date を端末ローカルの "YYYY-MM-DD" にする。toISOString は UTC になるので使わない。 */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今日の日付。旅行中は端末の時計が現地時刻になっている前提で時差補正はしない。 */
export function todayLocal(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** "YYYY-MM-DD" をローカル時刻 0 時の Date にする。 */
export function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-09-12" → "9/12(土)" */
export function formatDateLabel(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function addDays(isoDate: string, days: number): string {
  const d = parseIsoDate(isoDate);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}
```

- [ ] **Step 8: 実行して通過を確認する**

```bash
npm run test
```

期待: 8 件すべて PASS。

- [ ] **Step 9: 型チェックとビルドを確認する**

```bash
npm run build
```

期待: エラーなしで `dist/` が生成される。

- [ ] **Step 10: コミット**

```bash
git add -A && git commit -m "feat: プロジェクト初期化と日付ユーティリティを追加"
```

---

### Task 2: ドメイン型・通貨定義・金額換算

**Files:**
- Create: `src/domain/types.ts`, `src/domain/currency.ts`, `src/domain/money.ts`
- Test: `src/domain/currency.test.ts`, `src/domain/money.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - 型: `Scope`, `Category`, `Payment`, `RateSource`, `Trip`, `Expense`, `Photo`, `RateCache`
  - `CURRENCIES: CurrencyInfo[]`, `findCurrency(code: string): CurrencyInfo | undefined`, `currencyDecimals(code: string): number`, `currencySymbol(code: string): string`
  - `minorToMajor(amountMinor: number, decimals: number): number`
  - `formatMajor(amountMinor: number, decimals: number): string`
  - `parseMajorToMinor(input: string, decimals: number): number`
  - `toJpy(amountMinor: number, decimals: number, rate: number): number`
  - `formatJpy(jpy: number): string`
  - `formatWithCurrency(amountMinor: number, currency: string): string`

- [ ] **Step 1: ドメイン型を定義する**

`src/domain/types.ts`:

```ts
export type Scope = 'personal' | 'shared';
export type Category =
  | 'food'
  | 'transport'
  | 'sightseeing'
  | 'shopping'
  | 'lodging'
  | 'other';
export type Payment = 'cash' | 'mobile' | 'card';
export type RateSource = 'api' | 'cache' | 'manual';

export type Trip = {
  id: string;
  name: string;
  /** ISO 4217。"CNY" など */
  currency: string;
  /** 最小単位の桁数。CNY は 2、KRW は 0 */
  currencyDecimals: number;
  /** "2026-09-12" */
  startDate: string;
  endDate: string | null;
  /** 予算(円)。未設定は null */
  budgetJpy: number | null;
  /** 共有支出を割る人数。既定 1 */
  memberCount: number;
  createdAt: number;
};

export type Expense = {
  id: string;
  tripId: string;
  /** 現地日付 "2026-09-12" */
  date: string;
  /** 外貨の最小単位(元 → 分)。浮動小数にしない */
  amountMinor: number;
  scope: Scope;
  category: Category;
  payment: Payment;
  memo: string;
  /** 記録時点の「1 外貨 = ? 円」。以後再計算しない */
  rate: number;
  rateSource: RateSource;
  photoId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Photo = {
  id: string;
  /** 圧縮済み JPEG */
  blob: Blob;
};

export type RateCache = {
  /** "CNY:JPY:2026-09-12" */
  key: string;
  base: string;
  date: string;
  rate: number;
  /** API が実際に返した日付。土日祝は直近営業日になる */
  effectiveDate: string;
  fetchedAt: number;
  source: 'frankfurter' | 'er-api';
};
```

- [ ] **Step 2: 通貨定義の失敗するテストを書く**

`src/domain/currency.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CURRENCIES, findCurrency, currencyDecimals, currencySymbol } from './currency';

describe('CURRENCIES', () => {
  it('中国元を含む', () => {
    expect(CURRENCIES.map((c) => c.code)).toContain('CNY');
  });

  it('ECB 非対応の通貨を含まない', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).not.toContain('TWD');
    expect(codes).not.toContain('VND');
  });

  it('コードが重複しない', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('currencyDecimals', () => {
  it('中国元は 2 桁', () => {
    expect(currencyDecimals('CNY')).toBe(2);
  });

  it('韓国ウォンは 0 桁', () => {
    expect(currencyDecimals('KRW')).toBe(0);
  });

  it('未知の通貨は 2 桁とみなす', () => {
    expect(currencyDecimals('XXX')).toBe(2);
  });
});

describe('findCurrency / currencySymbol', () => {
  it('未知のコードは undefined', () => {
    expect(findCurrency('XXX')).toBeUndefined();
  });

  it('記号を返す。未知ならコードをそのまま返す', () => {
    expect(currencySymbol('CNY')).toBe('元');
    expect(currencySymbol('XXX')).toBe('XXX');
  });
});
```

- [ ] **Step 3: 実行して失敗を確認する**

```bash
npx vitest run src/domain/currency.test.ts
```

期待: `Failed to resolve import "./currency"` で失敗する。

- [ ] **Step 4: 通貨定義を実装する**

`src/domain/currency.ts`:

```ts
export type CurrencyInfo = {
  code: string;
  /** 最小単位の桁数 */
  decimals: number;
  label: string;
  symbol: string;
};

// レート取得は Frankfurter(ECB 参照レート)が主なので、ECB が公表する通貨だけを載せる。
// 台湾ドル(TWD)・ベトナムドン(VND)・インドネシアルピア(IDR)は ECB の対象外で
// レートを取得できないため、ここに追加してはいけない。
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'CNY', decimals: 2, label: '中国元', symbol: '元' },
  { code: 'KRW', decimals: 0, label: '韓国ウォン', symbol: '₩' },
  { code: 'USD', decimals: 2, label: '米ドル', symbol: '$' },
  { code: 'EUR', decimals: 2, label: 'ユーロ', symbol: '€' },
  { code: 'THB', decimals: 2, label: 'タイバーツ', symbol: '฿' },
  { code: 'HKD', decimals: 2, label: '香港ドル', symbol: 'HK$' },
  { code: 'SGD', decimals: 2, label: 'シンガポールドル', symbol: 'S$' },
  { code: 'GBP', decimals: 2, label: '英ポンド', symbol: '£' },
  { code: 'AUD', decimals: 2, label: '豪ドル', symbol: 'A$' },
];

export function findCurrency(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function currencyDecimals(code: string): number {
  return findCurrency(code)?.decimals ?? 2;
}

export function currencySymbol(code: string): string {
  return findCurrency(code)?.symbol ?? code;
}
```

- [ ] **Step 5: 金額換算の失敗するテストを書く**

`src/domain/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  minorToMajor,
  formatMajor,
  parseMajorToMinor,
  toJpy,
  formatJpy,
  formatWithCurrency,
} from './money';

describe('minorToMajor', () => {
  it('小数 2 桁の通貨を戻す', () => {
    expect(minorToMajor(1234, 2)).toBe(12.34);
  });

  it('小数 0 桁の通貨はそのまま', () => {
    expect(minorToMajor(1500, 0)).toBe(1500);
  });
});

describe('formatMajor', () => {
  it('小数 2 桁で表示する', () => {
    expect(formatMajor(1234, 2)).toBe('12.34');
  });

  it('端数を 0 埋めする', () => {
    expect(formatMajor(1200, 2)).toBe('12.00');
    expect(formatMajor(5, 2)).toBe('0.05');
  });

  it('3 桁区切りを入れる', () => {
    expect(formatMajor(120000, 2)).toBe('1,200.00');
    expect(formatMajor(50000, 0)).toBe('50,000');
  });
});

describe('parseMajorToMinor', () => {
  it('小数入力を最小単位にする', () => {
    expect(parseMajorToMinor('12.34', 2)).toBe(1234);
    expect(parseMajorToMinor('12.3', 2)).toBe(1230);
    expect(parseMajorToMinor('120', 2)).toBe(12000);
  });

  it('小数 0 桁の通貨は四捨五入する', () => {
    expect(parseMajorToMinor('1500', 0)).toBe(1500);
    expect(parseMajorToMinor('1500.6', 0)).toBe(1501);
  });

  it('入力途中や空文字は 0 にする', () => {
    expect(parseMajorToMinor('', 2)).toBe(0);
    expect(parseMajorToMinor('.', 2)).toBe(0);
    expect(parseMajorToMinor('12.', 2)).toBe(1200);
    expect(parseMajorToMinor('abc', 2)).toBe(0);
  });

  it('浮動小数の誤差を持ち込まない', () => {
    expect(parseMajorToMinor('0.29', 2)).toBe(29);
    expect(parseMajorToMinor('1.005', 2)).toBe(101);
  });
});

describe('toJpy', () => {
  it('レートを掛けて円に丸める', () => {
    // 120.00 元 × 23.465 = 2815.8 → 2816
    expect(toJpy(12000, 2, 23.465)).toBe(2816);
  });

  it('1 円未満は 0 になる', () => {
    expect(toJpy(1, 2, 23.465)).toBe(0);
  });

  it('小数 0 桁の通貨も扱える', () => {
    // 10000 ウォン × 0.1085 = 1085
    expect(toJpy(10000, 0, 0.1085)).toBe(1085);
  });

  it('金額 0 は 0', () => {
    expect(toJpy(0, 2, 23.465)).toBe(0);
  });
});

describe('formatJpy', () => {
  it('通貨記号と 3 桁区切りを付ける', () => {
    expect(formatJpy(2816)).toBe('¥2,816');
    expect(formatJpy(0)).toBe('¥0');
    expect(formatJpy(1234567)).toBe('¥1,234,567');
  });

  it('負の値は記号の前に符号を置く', () => {
    expect(formatJpy(-1200)).toBe('-¥1,200');
  });
});

describe('formatWithCurrency', () => {
  it('通貨記号付きで表示する', () => {
    expect(formatWithCurrency(12000, 'CNY')).toBe('120.00元');
    expect(formatWithCurrency(15000, 'KRW')).toBe('₩15,000');
  });
});
```

- [ ] **Step 6: 実行して失敗を確認する**

```bash
npx vitest run src/domain/money.test.ts
```

期待: `Failed to resolve import "./money"` で失敗する。

- [ ] **Step 7: 金額換算を実装する**

`src/domain/money.ts`:

```ts
import { currencyDecimals, currencySymbol } from './currency';

function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function minorToMajor(amountMinor: number, decimals: number): number {
  return amountMinor / 10 ** decimals;
}

/** 最小単位の整数を表示用の文字列にする。"1,200.00" など。 */
export function formatMajor(amountMinor: number, decimals: number): string {
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(amountMinor));
  const unit = 10 ** decimals;
  const head = group(Math.floor(abs / unit));
  if (decimals === 0) return sign + head;
  const frac = String(abs % unit).padStart(decimals, '0');
  return `${sign}${head}.${frac}`;
}

/** テンキーからの入力文字列を最小単位の整数にする。不正な入力は 0 とみなす。 */
export function parseMajorToMinor(input: string, decimals: number): number {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '.') return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return 0;
  // 小数の丸め誤差(1.005 * 100 = 100.49999…)を避けるため文字列経由で丸める
  return Math.round(Number((value * 10 ** decimals).toFixed(4)));
}

/** 外貨の最小単位を円に換算する。円換算はこの関数だけを通す。 */
export function toJpy(amountMinor: number, decimals: number, rate: number): number {
  return Math.round(minorToMajor(amountMinor, decimals) * rate);
}

export function formatJpy(jpy: number): string {
  const rounded = Math.round(jpy);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}¥${group(Math.abs(rounded))}`;
}

/** 通貨記号を添えた外貨表示。記号が後置の通貨(元)は末尾に付ける。 */
export function formatWithCurrency(amountMinor: number, currency: string): string {
  const body = formatMajor(amountMinor, currencyDecimals(currency));
  const symbol = currencySymbol(currency);
  return currency === 'CNY' ? `${body}${symbol}` : `${symbol}${body}`;
}
```

- [ ] **Step 8: 実行して通過を確認する**

```bash
npm run test
```

期待: `date` / `currency` / `money` のテストがすべて PASS。

- [ ] **Step 9: コミット**

```bash
git add -A && git commit -m "feat: ドメイン型・通貨定義・金額換算を追加"
```

---

### Task 3: カテゴリ定義と集計ロジック

**Files:**
- Create: `src/domain/categories.ts`, `src/domain/summary.ts`
- Test: `src/domain/summary.test.ts`

**Interfaces:**
- Consumes: `Expense`, `Trip`, `Category`, `Payment`, `Scope`(Task 2)、`toJpy`(Task 2)
- Produces:
  - `CATEGORIES`, `PAYMENTS`, `SCOPES`(いずれも `{ value, label, icon }[]`。`SCOPES` に icon はない)
  - `categoryLabel(v: Category): string`, `categoryIcon(v: Category): string`, `paymentLabel(v: Payment): string`, `paymentIcon(v: Payment): string`, `scopeLabel(v: Scope): string`
  - `expenseJpy(e: Expense, trip: Trip): number`
  - `summarize(expenses: Expense[], trip: Trip): TripSummary`
  - `breakdownByCategory(expenses: Expense[], trip: Trip): CategoryBreakdown[]`
  - `totalsByDate(expenses: Expense[], trip: Trip): DateTotal[]`
  - `groupByDate(expenses: Expense[], trip: Trip): DateGroup[]`

- [ ] **Step 1: カテゴリ定義を書く**

`src/domain/categories.ts`:

```ts
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
```

- [ ] **Step 2: 集計の失敗するテストを書く**

`src/domain/summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Expense, Trip } from './types';
import {
  expenseJpy,
  summarize,
  breakdownByCategory,
  totalsByDate,
  groupByDate,
} from './summary';

const trip: Trip = {
  id: 't1',
  name: '上海 2026-09',
  currency: 'CNY',
  currencyDecimals: 2,
  startDate: '2026-09-12',
  endDate: '2026-09-15',
  budgetJpy: 100000,
  memberCount: 2,
  createdAt: 0,
};

let seq = 0;
function expense(over: Partial<Expense> = {}): Expense {
  seq += 1;
  return {
    id: `e${seq}`,
    tripId: 't1',
    date: '2026-09-12',
    amountMinor: 10000, // 100.00 元
    scope: 'personal',
    category: 'food',
    payment: 'cash',
    memo: '',
    rate: 20, // 1 元 = 20 円 → 2000 円
    rateSource: 'api',
    photoId: null,
    createdAt: seq,
    updatedAt: seq,
    ...over,
  };
}

describe('expenseJpy', () => {
  it('支出に焼き付いたレートで換算する', () => {
    expect(expenseJpy(expense(), trip)).toBe(2000);
  });

  it('支出ごとにレートが違っても各自のレートを使う', () => {
    expect(expenseJpy(expense({ rate: 25 }), trip)).toBe(2500);
  });
});

describe('summarize', () => {
  it('支出が無いときはすべて 0、残額は予算のまま', () => {
    const s = summarize([], trip);
    expect(s.count).toBe(0);
    expect(s.totalMinor).toBe(0);
    expect(s.totalJpy).toBe(0);
    expect(s.myTotalJpy).toBe(0);
    expect(s.remainingJpy).toBe(100000);
  });

  it('個別と共有を分けて集計し、共有は人数で割る', () => {
    const s = summarize(
      [expense({ amountMinor: 10000 }), expense({ amountMinor: 20000, scope: 'shared' })],
      trip,
    );
    expect(s.count).toBe(2);
    expect(s.totalMinor).toBe(30000);
    expect(s.personalJpy).toBe(2000);
    expect(s.sharedJpy).toBe(4000);
    expect(s.sharedPerPersonJpy).toBe(2000);
    expect(s.myTotalJpy).toBe(4000);
    expect(s.totalJpy).toBe(6000);
  });

  it('残額は支出合計(自己負担ではない)を予算から引く', () => {
    const s = summarize([expense({ amountMinor: 20000, scope: 'shared' })], trip);
    expect(s.remainingJpy).toBe(96000);
  });

  it('予算未設定なら残額は null', () => {
    const s = summarize([expense()], { ...trip, budgetJpy: null });
    expect(s.remainingJpy).toBeNull();
  });

  it('人数が 0 でも 0 除算しない', () => {
    const s = summarize([expense({ scope: 'shared' })], { ...trip, memberCount: 0 });
    expect(s.sharedPerPersonJpy).toBe(2000);
  });

  it('合計は行ごとに丸めた円の和にする(表示と一致させるため)', () => {
    // 0.03 元 × 23.465 = 0.70395 → 行の表示は 1 円。2 行なので合計 2 円。
    // 先に合計してから丸めると 1 円になり、画面の行と合わない。
    const es = [
      expense({ amountMinor: 3, rate: 23.465 }),
      expense({ amountMinor: 3, rate: 23.465 }),
    ];
    expect(summarize(es, trip).totalJpy).toBe(2);
  });
});

describe('breakdownByCategory', () => {
  it('金額の多い順に並べ、構成比を付ける', () => {
    const rows = breakdownByCategory(
      [
        expense({ amountMinor: 10000, category: 'food' }),
        expense({ amountMinor: 20000, category: 'transport' }),
      ],
      trip,
    );
    expect(rows.map((r) => r.category)).toEqual(['transport', 'food']);
    expect(rows[0].jpy).toBe(4000);
    expect(rows[0].ratio).toBeCloseTo(2 / 3, 5);
  });

  it('同じカテゴリはまとめる', () => {
    const rows = breakdownByCategory(
      [expense({ category: 'food' }), expense({ category: 'food' })],
      trip,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].jpy).toBe(4000);
  });

  it('支出が無ければ空配列', () => {
    expect(breakdownByCategory([], trip)).toEqual([]);
  });
});

describe('totalsByDate', () => {
  it('日付の昇順で日別合計を返す', () => {
    const rows = totalsByDate(
      [expense({ date: '2026-09-13' }), expense({ date: '2026-09-12' })],
      trip,
    );
    expect(rows.map((r) => r.date)).toEqual(['2026-09-12', '2026-09-13']);
    expect(rows[0].jpy).toBe(2000);
  });
});

describe('groupByDate', () => {
  it('日付の降順にまとめ、各日の中は新しい順にする', () => {
    const older = expense({ date: '2026-09-12', createdAt: 1, id: 'old' });
    const newer = expense({ date: '2026-09-12', createdAt: 2, id: 'new' });
    const other = expense({ date: '2026-09-13', id: 'other' });
    const groups = groupByDate([older, other, newer], trip);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-13', '2026-09-12']);
    expect(groups[1].expenses.map((e) => e.id)).toEqual(['new', 'old']);
    expect(groups[1].jpy).toBe(4000);
  });
});
```

- [ ] **Step 3: 実行して失敗を確認する**

```bash
npx vitest run src/domain/summary.test.ts
```

期待: `Failed to resolve import "./summary"` で失敗する。

- [ ] **Step 4: 集計を実装する**

`src/domain/summary.ts`:

```ts
import type { Category, Expense, Trip } from './types';
import { toJpy } from './money';

export type TripSummary = {
  count: number;
  /** 外貨の最小単位の合計 */
  totalMinor: number;
  totalJpy: number;
  personalJpy: number;
  sharedJpy: number;
  /** 共有支出を人数で割った自分の負担 */
  sharedPerPersonJpy: number;
  /** 個別 + 共有の自己負担 */
  myTotalJpy: number;
  budgetJpy: number | null;
  /** 予算 - 支出合計。予算未設定なら null */
  remainingJpy: number | null;
};

export type CategoryBreakdown = { category: Category; jpy: number; ratio: number };
export type DateTotal = { date: string; jpy: number };
export type DateGroup = { date: string; expenses: Expense[]; jpy: number };

/** 支出 1 件の円換算。焼き付けたレートを使い、再取得しない。 */
export function expenseJpy(e: Expense, trip: Trip): number {
  return toJpy(e.amountMinor, trip.currencyDecimals, e.rate);
}

export function summarize(expenses: Expense[], trip: Trip): TripSummary {
  let totalMinor = 0;
  let personalJpy = 0;
  let sharedJpy = 0;

  for (const e of expenses) {
    totalMinor += e.amountMinor;
    // 行ごとに丸めてから足す。画面に出る各行の合計と一致させるため。
    const jpy = expenseJpy(e, trip);
    if (e.scope === 'shared') sharedJpy += jpy;
    else personalJpy += jpy;
  }

  const totalJpy = personalJpy + sharedJpy;
  const members = Math.max(1, trip.memberCount);
  const sharedPerPersonJpy = Math.round(sharedJpy / members);

  return {
    count: expenses.length,
    totalMinor,
    totalJpy,
    personalJpy,
    sharedJpy,
    sharedPerPersonJpy,
    myTotalJpy: personalJpy + sharedPerPersonJpy,
    budgetJpy: trip.budgetJpy,
    remainingJpy: trip.budgetJpy === null ? null : trip.budgetJpy - totalJpy,
  };
}

export function breakdownByCategory(expenses: Expense[], trip: Trip): CategoryBreakdown[] {
  const totals = new Map<Category, number>();
  let total = 0;

  for (const e of expenses) {
    const jpy = expenseJpy(e, trip);
    totals.set(e.category, (totals.get(e.category) ?? 0) + jpy);
    total += jpy;
  }

  return [...totals.entries()]
    .map(([category, jpy]) => ({ category, jpy, ratio: total === 0 ? 0 : jpy / total }))
    .sort((a, b) => b.jpy - a.jpy);
}

export function totalsByDate(expenses: Expense[], trip: Trip): DateTotal[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    totals.set(e.date, (totals.get(e.date) ?? 0) + expenseJpy(e, trip));
  }
  return [...totals.entries()]
    .map(([date, jpy]) => ({ date, jpy }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupByDate(expenses: Expense[], trip: Trip): DateGroup[] {
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    const list = groups.get(e.date);
    if (list) list.push(e);
    else groups.set(e.date, [e]);
  }

  return [...groups.entries()]
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
      return {
        date,
        expenses: sorted,
        jpy: sorted.reduce((sum, e) => sum + expenseJpy(e, trip), 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
```

- [ ] **Step 5: 実行して通過を確認する**

```bash
npm run test
```

期待: すべて PASS。

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat: カテゴリ定義と集計ロジックを追加"
```

---

### Task 4: Dexie スキーマとリポジトリ層

**Files:**
- Create: `src/data/db.ts`, `src/data/tripRepo.ts`, `src/data/expenseRepo.ts`, `src/data/photoRepo.ts`, `src/data/rateCacheRepo.ts`
- Test: `src/data/repos.test.ts`

**Interfaces:**
- Consumes: `Trip`, `Expense`, `Photo`, `RateCache`(Task 2)、`currencyDecimals`(Task 2)、`todayLocal`(Task 1)
- Produces:
  - `db: TripWalletDb`(テーブル `trips` / `expenses` / `photos` / `rates`)、`newId(): string`
  - `createTrip(input: TripInput): Promise<Trip>`, `updateTrip(id, patch: Partial<TripInput>): Promise<void>`, `listTrips(): Promise<Trip[]>`, `getTrip(id): Promise<Trip | undefined>`, `deleteTrip(id): Promise<void>`
  - `addExpense(input: ExpenseInput): Promise<Expense>`, `updateExpense(id, patch: Partial<ExpenseInput>): Promise<void>`, `deleteExpense(id): Promise<void>`, `listExpenses(tripId): Promise<Expense[]>`, `getExpense(id): Promise<Expense | undefined>`
  - `savePhoto(blob: Blob): Promise<string>`, `getPhoto(id): Promise<Blob | undefined>`, `deletePhoto(id): Promise<void>`
  - `rateKey(base, date): string`, `getCachedRate(base, date)`, `putCachedRate(entry)`, `latestCachedRate(base)`, `countCachedRates()`

- [ ] **Step 1: 失敗するテストを書く**

`src/data/repos.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { createTrip, updateTrip, listTrips, getTrip, deleteTrip } from './tripRepo';
import { addExpense, updateExpense, deleteExpense, listExpenses } from './expenseRepo';
import { savePhoto, getPhoto } from './photoRepo';
import {
  rateKey,
  getCachedRate,
  putCachedRate,
  latestCachedRate,
  countCachedRates,
} from './rateCacheRepo';
import type { ExpenseInput } from './expenseRepo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function expenseInput(over: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    tripId: 't1',
    date: '2026-09-12',
    amountMinor: 10000,
    scope: 'personal',
    category: 'food',
    payment: 'cash',
    memo: '',
    rate: 20,
    rateSource: 'api',
    photoId: null,
    ...over,
  };
}

describe('tripRepo', () => {
  it('通貨から小数桁数を自動で決めて保存する', async () => {
    const trip = await createTrip({ name: '上海', currency: 'CNY' });
    expect(trip.currencyDecimals).toBe(2);
    expect((await getTrip(trip.id))?.name).toBe('上海');

    const seoul = await createTrip({ name: 'ソウル', currency: 'KRW' });
    expect(seoul.currencyDecimals).toBe(0);
  });

  it('既定値は 1 人・予算なし・終了日なし', async () => {
    const trip = await createTrip({ name: '上海', currency: 'CNY' });
    expect(trip.memberCount).toBe(1);
    expect(trip.budgetJpy).toBeNull();
    expect(trip.endDate).toBeNull();
  });

  it('新しい旅行から順に並ぶ', async () => {
    const a = await createTrip({ name: '古い', currency: 'CNY' });
    await new Promise((r) => setTimeout(r, 2));
    const b = await createTrip({ name: '新しい', currency: 'CNY' });
    expect((await listTrips()).map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it('通貨を変えると小数桁数も追随する', async () => {
    const trip = await createTrip({ name: '旅', currency: 'CNY' });
    await updateTrip(trip.id, { currency: 'KRW' });
    expect((await getTrip(trip.id))?.currencyDecimals).toBe(0);
  });

  it('人数は 1 未満にできない', async () => {
    const trip = await createTrip({ name: '旅', currency: 'CNY', memberCount: 0 });
    expect(trip.memberCount).toBe(1);
    await updateTrip(trip.id, { memberCount: -3 });
    expect((await getTrip(trip.id))?.memberCount).toBe(1);
  });

  it('旅行を消すと支出と写真も消える', async () => {
    const trip = await createTrip({ name: '旅', currency: 'CNY' });
    const photoId = await savePhoto(new Blob(['x'], { type: 'image/jpeg' }));
    await addExpense(expenseInput({ tripId: trip.id, photoId }));
    await deleteTrip(trip.id);

    expect(await getTrip(trip.id)).toBeUndefined();
    expect(await listExpenses(trip.id)).toEqual([]);
    expect(await getPhoto(photoId)).toBeUndefined();
  });
});

describe('expenseRepo', () => {
  it('id と作成時刻を採番して保存する', async () => {
    const e = await addExpense(expenseInput());
    expect(e.id).toBeTruthy();
    expect(e.createdAt).toBeGreaterThan(0);
    expect(e.updatedAt).toBe(e.createdAt);
  });

  it('旅行ごとに絞り込む', async () => {
    await addExpense(expenseInput({ tripId: 't1' }));
    await addExpense(expenseInput({ tripId: 't2' }));
    expect(await listExpenses('t1')).toHaveLength(1);
  });

  it('日付の新しい順、同日なら登録の新しい順に並ぶ', async () => {
    const old = await addExpense(expenseInput({ date: '2026-09-12' }));
    await new Promise((r) => setTimeout(r, 2));
    const same = await addExpense(expenseInput({ date: '2026-09-12' }));
    const later = await addExpense(expenseInput({ date: '2026-09-13' }));
    expect((await listExpenses('t1')).map((e) => e.id)).toEqual([later.id, same.id, old.id]);
  });

  it('更新すると updatedAt が進む', async () => {
    const e = await addExpense(expenseInput());
    await new Promise((r) => setTimeout(r, 2));
    await updateExpense(e.id, { memo: '小籠包' });
    const after = (await listExpenses('t1'))[0];
    expect(after.memo).toBe('小籠包');
    expect(after.updatedAt).toBeGreaterThan(e.updatedAt);
  });

  it('支出を消すと紐づく写真も消える', async () => {
    const photoId = await savePhoto(new Blob(['x'], { type: 'image/jpeg' }));
    const e = await addExpense(expenseInput({ photoId }));
    await deleteExpense(e.id);
    expect(await listExpenses('t1')).toEqual([]);
    expect(await getPhoto(photoId)).toBeUndefined();
  });
});

describe('rateCacheRepo', () => {
  it('キーは通貨と日付から決まる', () => {
    expect(rateKey('CNY', '2026-09-12')).toBe('CNY:JPY:2026-09-12');
  });

  it('保存して読み戻せる', async () => {
    await putCachedRate({
      key: rateKey('CNY', '2026-09-12'),
      base: 'CNY',
      date: '2026-09-12',
      rate: 23.465,
      effectiveDate: '2026-09-11',
      fetchedAt: Date.now(),
      source: 'frankfurter',
    });
    expect((await getCachedRate('CNY', '2026-09-12'))?.rate).toBe(23.465);
    expect(await countCachedRates()).toBe(1);
  });

  it('同じ通貨で最も新しい日付のものを返す', async () => {
    for (const [date, rate] of [
      ['2026-09-10', 23.0],
      ['2026-09-12', 23.5],
      ['2026-09-11', 23.2],
    ] as const) {
      await putCachedRate({
        key: rateKey('CNY', date),
        base: 'CNY',
        date,
        rate,
        effectiveDate: date,
        fetchedAt: 0,
        source: 'frankfurter',
      });
    }
    await putCachedRate({
      key: rateKey('KRW', '2026-12-31'),
      base: 'KRW',
      date: '2026-12-31',
      rate: 0.1,
      effectiveDate: '2026-12-31',
      fetchedAt: 0,
      source: 'frankfurter',
    });

    const latest = await latestCachedRate('CNY');
    expect(latest?.date).toBe('2026-09-12');
  });

  it('キャッシュが無ければ undefined', async () => {
    expect(await latestCachedRate('CNY')).toBeUndefined();
    expect(await getCachedRate('CNY', '2026-09-12')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 実行して失敗を確認する**

```bash
npx vitest run src/data/repos.test.ts
```

期待: `Failed to resolve import "./db"` で失敗する。

- [ ] **Step 3: Dexie スキーマを書く**

`src/data/db.ts`:

```ts
import Dexie, { type EntityTable } from 'dexie';
import type { Expense, Photo, RateCache, Trip } from '../domain/types';

export class TripWalletDb extends Dexie {
  trips!: EntityTable<Trip, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  rates!: EntityTable<RateCache, 'key'>;

  constructor() {
    super('trip-wallet');
    this.version(1).stores({
      trips: 'id, createdAt',
      expenses: 'id, tripId, [tripId+date], date, createdAt',
      photos: 'id',
      rates: 'key, [base+date], date',
    });
  }
}

export const db = new TripWalletDb();

/** jsdom や古い WebView では crypto.randomUUID が無いことがある。 */
export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 4: 写真リポジトリを書く**

`src/data/photoRepo.ts`:

```ts
import { db, newId } from './db';

export async function savePhoto(blob: Blob): Promise<string> {
  const id = newId();
  await db.photos.add({ id, blob });
  return id;
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  return (await db.photos.get(id))?.blob;
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}
```

- [ ] **Step 5: 旅行リポジトリを書く**

`src/data/tripRepo.ts`:

```ts
import { currencyDecimals } from '../domain/currency';
import { todayLocal } from '../domain/date';
import type { Trip } from '../domain/types';
import { db, newId } from './db';

export type TripInput = {
  name: string;
  currency: string;
  startDate?: string;
  endDate?: string | null;
  budgetJpy?: number | null;
  memberCount?: number;
};

export async function createTrip(input: TripInput): Promise<Trip> {
  const trip: Trip = {
    id: newId(),
    name: input.name,
    currency: input.currency,
    currencyDecimals: currencyDecimals(input.currency),
    startDate: input.startDate ?? todayLocal(),
    endDate: input.endDate ?? null,
    budgetJpy: input.budgetJpy ?? null,
    memberCount: Math.max(1, input.memberCount ?? 1),
    createdAt: Date.now(),
  };
  await db.trips.add(trip);
  return trip;
}

export async function updateTrip(id: string, patch: Partial<TripInput>): Promise<void> {
  const changes: Partial<Trip> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.startDate !== undefined) changes.startDate = patch.startDate;
  if (patch.endDate !== undefined) changes.endDate = patch.endDate;
  if (patch.budgetJpy !== undefined) changes.budgetJpy = patch.budgetJpy;
  if (patch.memberCount !== undefined) changes.memberCount = Math.max(1, patch.memberCount);
  if (patch.currency !== undefined) {
    changes.currency = patch.currency;
    // 小数桁数は通貨から必ず導く。手で食い違わせない。
    changes.currencyDecimals = currencyDecimals(patch.currency);
  }
  await db.trips.update(id, changes);
}

export function getTrip(id: string): Promise<Trip | undefined> {
  return db.trips.get(id);
}

export async function listTrips(): Promise<Trip[]> {
  return db.trips.orderBy('createdAt').reverse().toArray();
}

/** 旅行に紐づく支出と写真もまとめて消す。孤児レコードを残さない。 */
export async function deleteTrip(id: string): Promise<void> {
  await db.transaction('rw', db.trips, db.expenses, db.photos, async () => {
    const expenses = await db.expenses.where('tripId').equals(id).toArray();
    const photoIds = expenses.map((e) => e.photoId).filter((p): p is string => p !== null);
    if (photoIds.length > 0) await db.photos.bulkDelete(photoIds);
    await db.expenses.bulkDelete(expenses.map((e) => e.id));
    await db.trips.delete(id);
  });
}
```

- [ ] **Step 6: 支出リポジトリを書く**

`src/data/expenseRepo.ts`:

```ts
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
```

- [ ] **Step 7: レートキャッシュのリポジトリを書く**

`src/data/rateCacheRepo.ts`:

```ts
import type { RateCache } from '../domain/types';
import { db } from './db';

export function rateKey(base: string, date: string): string {
  return `${base}:JPY:${date}`;
}

export function getCachedRate(base: string, date: string): Promise<RateCache | undefined> {
  return db.rates.get(rateKey(base, date));
}

export async function putCachedRate(entry: RateCache): Promise<void> {
  await db.rates.put(entry);
}

/** 同じ通貨で最も新しい日付のキャッシュ。オフライン時のフォールバックに使う。 */
export async function latestCachedRate(base: string): Promise<RateCache | undefined> {
  const rows = await db.rates.where('base').equals(base).toArray();
  if (rows.length === 0) return undefined;
  return rows.sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function countCachedRates(): Promise<number> {
  return db.rates.count();
}
```

- [ ] **Step 8: `base` インデックスを追加してテストを通す**

`latestCachedRate` が `where('base')` を使うので、`src/data/db.ts` の `rates` の定義を次に差し替える:

```ts
      rates: 'key, base, [base+date], date',
```

- [ ] **Step 9: 実行して通過を確認する**

```bash
npm run test
```

期待: repos のテストを含めすべて PASS。

- [ ] **Step 10: コミット**

```bash
git add -A && git commit -m "feat: Dexie スキーマとリポジトリ層を追加"
```

---

### Task 5: 為替レートの取得と解決

**Files:**
- Create: `src/rates/frankfurter.ts`, `src/rates/erApi.ts`, `src/rates/resolveRate.ts`
- Test: `src/rates/frankfurter.test.ts`, `src/rates/erApi.test.ts`, `src/rates/resolveRate.test.ts`

**Interfaces:**
- Consumes: `rateKey` / `getCachedRate` / `putCachedRate` / `latestCachedRate`(Task 4)、`todayLocal` / `toIsoDate`(Task 1)、`RateSource`(Task 2)
- Produces:
  - `type FetchedRate = { rate: number; effectiveDate: string }`
  - `fetchFrankfurterRate(base: string, date: string, fetchImpl?: typeof fetch): Promise<FetchedRate>`
  - `fetchErApiRate(base: string, fallbackDate: string, fetchImpl?: typeof fetch): Promise<FetchedRate>`
  - `type ResolvedRate = { rate: number; effectiveDate: string; source: RateSource; stale: boolean }`
  - `resolveRate(base: string, date: string, overrides?: Partial<ResolveRateDeps>): Promise<ResolvedRate | null>`
  - `prefetchTodayRate(base: string): Promise<ResolvedRate | null>`

- [ ] **Step 1: Frankfurter クライアントの失敗するテストを書く**

`src/rates/frankfurter.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchFrankfurterRate } from './frankfurter';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchFrankfurterRate', () => {
  it('日付と通貨を指定して JPY レートを取り出す', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ amount: 1, base: 'CNY', date: '2026-09-11', rates: { JPY: 23.465 } }),
    );
    const result = await fetchFrankfurterRate('CNY', '2026-09-12', fetchImpl as never);

    expect(result).toEqual({ rate: 23.465, effectiveDate: '2026-09-11' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v1/2026-09-12?base=CNY&symbols=JPY',
    );
  });

  it('HTTP エラーは例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 404));
    await expect(fetchFrankfurterRate('CNY', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });

  it('JPY が含まれない応答は例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ date: '2026-09-12', rates: {} }));
    await expect(fetchFrankfurterRate('TWD', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });

  it('レートが 0 以下なら例外にする', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ date: '2026-09-12', rates: { JPY: 0 } }),
    );
    await expect(fetchFrankfurterRate('CNY', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 実行して失敗を確認する**

```bash
npx vitest run src/rates/frankfurter.test.ts
```

期待: `Failed to resolve import "./frankfurter"` で失敗する。

- [ ] **Step 3: Frankfurter クライアントを実装する**

`src/rates/frankfurter.ts`:

```ts
export type FetchedRate = {
  rate: number;
  /** API が実際に返した日付。土日祝は直近営業日になる */
  effectiveDate: string;
};

const BASE_URL = 'https://api.frankfurter.dev/v1';

/**
 * ECB 参照レートを日付指定で取得する。API キー不要・CORS 許可。
 * ECB の対象外通貨(TWD など)は rates が空で返るので例外にする。
 */
export async function fetchFrankfurterRate(
  base: string,
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedRate> {
  const res = await fetchImpl(`${BASE_URL}/${date}?base=${base}&symbols=JPY`);
  if (!res.ok) throw new Error(`Frankfurter が ${res.status} を返した`);

  const json = (await res.json()) as { date?: string; rates?: Record<string, number> };
  const rate = json.rates?.JPY;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Frankfurter が ${base} のレートを返さなかった`);
  }
  return { rate, effectiveDate: json.date ?? date };
}
```

- [ ] **Step 4: er-api クライアントの失敗するテストを書く**

`src/rates/erApi.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchErApiRate } from './erApi';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchErApiRate', () => {
  it('最新レートと更新日を取り出す', async () => {
    // 2026-09-12 00:00:00 UTC。ローカルへ変換した日付を effectiveDate にする
    const unix = Math.floor(Date.UTC(2026, 8, 12, 0, 0, 0) / 1000);
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ result: 'success', time_last_update_unix: unix, rates: { JPY: 23.5 } }),
    );
    const result = await fetchErApiRate('CNY', '2026-09-12', fetchImpl as never);

    expect(result.rate).toBe(23.5);
    expect(result.effectiveDate).toMatch(/^2026-09-1[12]$/);
    expect(fetchImpl).toHaveBeenCalledWith('https://open.er-api.com/v6/latest/CNY');
  });

  it('更新時刻が無ければ渡された日付を使う', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ result: 'success', rates: { JPY: 23.5 } }));
    const result = await fetchErApiRate('CNY', '2026-09-12', fetchImpl as never);
    expect(result.effectiveDate).toBe('2026-09-12');
  });

  it('result が error なら例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ result: 'error' }));
    await expect(fetchErApiRate('CNY', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });

  it('HTTP エラーは例外にする', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 500));
    await expect(fetchErApiRate('CNY', '2026-09-12', fetchImpl as never)).rejects.toThrow();
  });
});
```

- [ ] **Step 5: er-api クライアントを実装する**

`src/rates/erApi.ts`:

```ts
import { toIsoDate } from '../domain/date';
import type { FetchedRate } from './frankfurter';

/**
 * Frankfurter が落ちているときの当日レート用フォールバック。
 * 過去日は取得できないので、呼び出し側は当日のみで使うこと。
 */
export async function fetchErApiRate(
  base: string,
  fallbackDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedRate> {
  const res = await fetchImpl(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error(`er-api が ${res.status} を返した`);

  const json = (await res.json()) as {
    result?: string;
    time_last_update_unix?: number;
    rates?: Record<string, number>;
  };
  if (json.result === 'error') throw new Error('er-api がエラーを返した');

  const rate = json.rates?.JPY;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`er-api が ${base} のレートを返さなかった`);
  }

  const unix = json.time_last_update_unix;
  const effectiveDate =
    typeof unix === 'number' ? toIsoDate(new Date(unix * 1000)) : fallbackDate;
  return { rate, effectiveDate };
}
```

- [ ] **Step 6: レート解決の失敗するテストを書く**

`src/rates/resolveRate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { RateCache } from '../domain/types';
import { resolveRate, type ResolveRateDeps } from './resolveRate';

function cacheEntry(over: Partial<RateCache> = {}): RateCache {
  return {
    key: 'CNY:JPY:2026-09-12',
    base: 'CNY',
    date: '2026-09-12',
    rate: 23.4,
    effectiveDate: '2026-09-12',
    fetchedAt: 0,
    source: 'frankfurter',
    ...over,
  };
}

function deps(over: Partial<ResolveRateDeps> = {}): Partial<ResolveRateDeps> {
  return {
    getCachedRate: vi.fn(async () => undefined),
    putCachedRate: vi.fn(async () => undefined),
    latestCachedRate: vi.fn(async () => undefined),
    fetchFrankfurter: vi.fn(async () => {
      throw new Error('offline');
    }),
    fetchErApi: vi.fn(async () => {
      throw new Error('offline');
    }),
    today: '2026-09-12',
    ...over,
  };
}

describe('resolveRate', () => {
  it('キャッシュに当たれば通信しない', async () => {
    const d = deps({ getCachedRate: vi.fn(async () => cacheEntry()) });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result).toEqual({
      rate: 23.4,
      effectiveDate: '2026-09-12',
      source: 'cache',
      stale: false,
    });
    expect(d.fetchFrankfurter).not.toHaveBeenCalled();
  });

  it('Frankfurter が成功したら結果をキャッシュに保存する', async () => {
    const d = deps({
      fetchFrankfurter: vi.fn(async () => ({ rate: 23.465, effectiveDate: '2026-09-12' })),
    });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result).toEqual({
      rate: 23.465,
      effectiveDate: '2026-09-12',
      source: 'api',
      stale: false,
    });
    expect(d.putCachedRate).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'CNY:JPY:2026-09-12',
        base: 'CNY',
        date: '2026-09-12',
        rate: 23.465,
        source: 'frankfurter',
      }),
    );
  });

  it('土日で直近営業日のレートが返ったら stale にする', async () => {
    const d = deps({
      fetchFrankfurter: vi.fn(async () => ({ rate: 23.4, effectiveDate: '2026-09-11' })),
    });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result?.stale).toBe(true);
    expect(result?.effectiveDate).toBe('2026-09-11');
  });

  it('Frankfurter が落ちていて当日なら er-api を試す', async () => {
    const d = deps({ fetchErApi: vi.fn(async () => ({ rate: 23.9, effectiveDate: '2026-09-12' })) });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result?.rate).toBe(23.9);
    expect(result?.source).toBe('api');
    expect(d.putCachedRate).toHaveBeenCalledWith(expect.objectContaining({ source: 'er-api' }));
  });

  it('過去日では er-api を呼ばない(当日レートしか返さないため)', async () => {
    const d = deps({
      latestCachedRate: vi.fn(async () => cacheEntry({ date: '2026-09-10', effectiveDate: '2026-09-10' })),
    });
    const result = await resolveRate('CNY', '2026-09-08', d);

    expect(d.fetchErApi).not.toHaveBeenCalled();
    expect(result?.source).toBe('cache');
    expect(result?.effectiveDate).toBe('2026-09-10');
  });

  it('通信が全滅したら直近キャッシュを stale 付きで返す', async () => {
    const d = deps({
      latestCachedRate: vi.fn(async () =>
        cacheEntry({ date: '2026-09-10', effectiveDate: '2026-09-10', rate: 23.0 }),
      ),
    });
    const result = await resolveRate('CNY', '2026-09-12', d);

    expect(result).toEqual({
      rate: 23.0,
      effectiveDate: '2026-09-10',
      source: 'cache',
      stale: true,
    });
  });

  it('キャッシュも空なら null を返す(UI で手動入力を求める)', async () => {
    expect(await resolveRate('CNY', '2026-09-12', deps())).toBeNull();
  });
});
```

- [ ] **Step 7: 実行して失敗を確認する**

```bash
npx vitest run src/rates/resolveRate.test.ts
```

期待: `Failed to resolve import "./resolveRate"` で失敗する。

- [ ] **Step 8: レート解決を実装する**

`src/rates/resolveRate.ts`:

```ts
import { getCachedRate, latestCachedRate, putCachedRate, rateKey } from '../data/rateCacheRepo';
import { todayLocal } from '../domain/date';
import type { RateCache, RateSource } from '../domain/types';
import { fetchErApiRate } from './erApi';
import { fetchFrankfurterRate, type FetchedRate } from './frankfurter';

export type ResolvedRate = {
  rate: number;
  /** そのレートが実際に成立した日付 */
  effectiveDate: string;
  source: RateSource;
  /** 要求した日付と effectiveDate がずれている。UI で日付を明示する */
  stale: boolean;
};

export type ResolveRateDeps = {
  getCachedRate: (base: string, date: string) => Promise<RateCache | undefined>;
  putCachedRate: (entry: RateCache) => Promise<void>;
  latestCachedRate: (base: string) => Promise<RateCache | undefined>;
  fetchFrankfurter: (base: string, date: string) => Promise<FetchedRate>;
  fetchErApi: (base: string, fallbackDate: string) => Promise<FetchedRate>;
  today: string;
};

function defaultDeps(): ResolveRateDeps {
  return {
    getCachedRate,
    putCachedRate,
    latestCachedRate,
    fetchFrankfurter: (base, date) => fetchFrankfurterRate(base, date),
    fetchErApi: (base, fallbackDate) => fetchErApiRate(base, fallbackDate),
    today: todayLocal(),
  };
}

/**
 * キャッシュ → Frankfurter →(当日のみ)er-api → 直近キャッシュ の順に解決する。
 * すべて外したら null。呼び出し側はレートの手動入力を求めること。
 */
export async function resolveRate(
  base: string,
  date: string,
  overrides: Partial<ResolveRateDeps> = {},
): Promise<ResolvedRate | null> {
  const deps = { ...defaultDeps(), ...overrides };

  const cached = await deps.getCachedRate(base, date);
  if (cached) {
    return {
      rate: cached.rate,
      effectiveDate: cached.effectiveDate,
      source: 'cache',
      stale: cached.effectiveDate !== date,
    };
  }

  const save = async (fetched: FetchedRate, source: RateCache['source']) => {
    await deps.putCachedRate({
      key: rateKey(base, date),
      base,
      date,
      rate: fetched.rate,
      effectiveDate: fetched.effectiveDate,
      fetchedAt: Date.now(),
      source,
    });
    return {
      rate: fetched.rate,
      effectiveDate: fetched.effectiveDate,
      source: 'api' as const,
      stale: fetched.effectiveDate !== date,
    };
  };

  try {
    return await save(await deps.fetchFrankfurter(base, date), 'frankfurter');
  } catch {
    // 次のフォールバックへ進む
  }

  // er-api は当日レートしか返さない。過去日に使うと嘘の値になる。
  if (date === deps.today) {
    try {
      return await save(await deps.fetchErApi(base, date), 'er-api');
    } catch {
      // 次のフォールバックへ進む
    }
  }

  const latest = await deps.latestCachedRate(base);
  if (latest) {
    return {
      rate: latest.rate,
      effectiveDate: latest.effectiveDate,
      source: 'cache',
      stale: latest.effectiveDate !== date,
    };
  }

  return null;
}

/** 起動時に当日レートを温めておく。現地で電波が悪くても入力を止めないため。 */
export function prefetchTodayRate(base: string): Promise<ResolvedRate | null> {
  return resolveRate(base, todayLocal());
}
```

- [ ] **Step 9: 実行して通過を確認する**

```bash
npm run test
```

期待: rates の 3 ファイルを含めすべて PASS。

- [ ] **Step 10: コミット**

```bash
git add -A && git commit -m "feat: 為替レートの取得とフォールバック解決を追加"
```

---

### Task 6: 写真の圧縮

**Files:**
- Create: `src/media/compressImage.ts`
- Test: `src/media/compressImage.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `MAX_EDGE = 1280`, `JPEG_QUALITY = 0.7`
  - `computeTargetSize(width: number, height: number, maxEdge: number): { width: number; height: number }`
  - `compressImage(file: Blob, maxEdge?: number, quality?: number): Promise<Blob>`

**Note:** `compressImage` 本体は canvas を使うため jsdom では動かない。自動テストは寸法計算(`computeTargetSize`)に限定し、実際の圧縮は Task 9 の手動確認でチェックする。

- [ ] **Step 1: 失敗するテストを書く**

`src/media/compressImage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeTargetSize, MAX_EDGE } from './compressImage';

describe('computeTargetSize', () => {
  it('横長は幅を上限に合わせる', () => {
    expect(computeTargetSize(2000, 1500, 1280)).toEqual({ width: 1280, height: 960 });
  });

  it('縦長は高さを上限に合わせる', () => {
    expect(computeTargetSize(1500, 2000, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it('上限以下の画像は拡大しない', () => {
    expect(computeTargetSize(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });

  it('ちょうど上限なら変えない', () => {
    expect(computeTargetSize(1280, 720, 1280)).toEqual({ width: 1280, height: 720 });
  });

  it('極端な縦横比でも 0 px にしない', () => {
    expect(computeTargetSize(4000, 3, 1280)).toEqual({ width: 1280, height: 1 });
  });

  it('既定の上限は 1280', () => {
    expect(MAX_EDGE).toBe(1280);
  });
});
```

- [ ] **Step 2: 実行して失敗を確認する**

```bash
npx vitest run src/media/compressImage.test.ts
```

期待: `Failed to resolve import "./compressImage"` で失敗する。

- [ ] **Step 3: 実装する**

`src/media/compressImage.ts`:

```ts
/** 長辺の上限。スマホのレシート写真はこれで十分読める。 */
export const MAX_EDGE = 1280;
export const JPEG_QUALITY = 0.7;

export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };

  const scale = maxEdge / longest;
  return {
    // 極端な縦横比でも 0 px にならないようにする
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** カメラで撮った画像を縮小して JPEG にする。IndexedDB の容量を食い潰さないため。 */
export async function compressImage(
  file: Blob,
  maxEdge: number = MAX_EDGE,
  quality: number = JPEG_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas の 2d コンテキストを取得できませんでした');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    if (!blob) throw new Error('JPEG への変換に失敗しました');
    return blob;
  } finally {
    bitmap.close();
  }
}
```

- [ ] **Step 4: 実行して通過を確認する**

```bash
npm run test
```

期待: すべて PASS。

- [ ] **Step 5: コミット**

```bash
git add -A && git commit -m "feat: 写真の縮小と JPEG 圧縮を追加"
```

---

### Task 7: JSON バックアップ(エクスポート/インポート)

**Files:**
- Create: `src/data/backup.ts`
- Test: `src/data/backup.test.ts`

**Interfaces:**
- Consumes: `db`(Task 4)、`toIsoDate`(Task 1)、`Trip` / `Expense`(Task 2)
- Produces:
  - `type BackupPhoto = { id: string; type: string; dataBase64: string }`
  - `type BackupFile = { format: 'trip-wallet-backup'; version: 1; exportedAt: number; trips: Trip[]; expenses: Expense[]; photos: BackupPhoto[] }`
  - `type ImportResult = { trips: number; expenses: number; photos: number }`
  - `blobToBase64(blob: Blob): Promise<string>`, `base64ToBlob(base64: string, type: string): Blob`
  - `exportBackup(): Promise<BackupFile>`, `serializeBackup(backup: BackupFile): string`
  - `parseBackup(text: string): BackupFile`(不正な入力は例外)
  - `importBackup(backup: BackupFile): Promise<ImportResult>`(マージ。同一 id は上書き)
  - `backupFileName(now?: Date): string`

- [ ] **Step 1: 失敗するテストを書く**

`src/data/backup.test.ts`:

```ts
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
    const trip = await createTrip({ name: '上海', currency: 'CNY', budgetJpy: 100000 });
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
    expect(backup.version).toBe(1);
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
    expect(trips[0].budgetJpy).toBe(100000);

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
    const other = await createTrip({ name: '別の旅', currency: 'KRW' });

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
});
```

- [ ] **Step 2: 実行して失敗を確認する**

```bash
npx vitest run src/data/backup.test.ts
```

期待: `Failed to resolve import "./backup"` で失敗する。

- [ ] **Step 3: 実装する**

`src/data/backup.ts`:

```ts
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

  return {
    format: 'trip-wallet-backup',
    version: 1,
    exportedAt: typeof b.exportedAt === 'number' ? b.exportedAt : 0,
    trips: b.trips,
    expenses: b.expenses,
    photos: Array.isArray(b.photos) ? b.photos : [],
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
```

- [ ] **Step 4: 実行して通過を確認する**

```bash
npm run test
```

期待: backup を含めすべて PASS。

- [ ] **Step 5: コミット**

```bash
git add -A && git commit -m "feat: JSON バックアップのエクスポートとインポートを追加"
```

---

### Task 8: 旅行の管理と設定画面

**Files:**
- Create: `src/app/useActiveTrip.ts`, `src/ui/Sheet.tsx`, `src/ui/TripForm.tsx`, `src/ui/SettingsScreen.tsx`
- Modify: `src/app/App.tsx`(Task 1 の仮実装を置き換える)、`src/styles.css`(末尾に追記)
- Test: `src/app/useActiveTrip.test.ts`, `src/ui/TripForm.test.tsx`

**Interfaces:**
- Consumes: `listTrips` / `createTrip` / `updateTrip` / `deleteTrip`(Task 4)、`exportBackup` / `serializeBackup` / `parseBackup` / `importBackup` / `backupFileName`(Task 7)、`CURRENCIES`(Task 2)、`todayLocal`(Task 1)、`countCachedRates`(Task 4)
- Produces:
  - `pickActiveTrip(trips: Trip[], storedId: string | null): Trip | null`
  - `useActiveTrip(): { trips: Trip[]; activeTrip: Trip | null; loading: boolean; selectTrip: (id: string) => void }`
  - `<Sheet title onClose>{children}</Sheet>`
  - `<TripForm trip?: Trip onDone: () => void onCancel: () => void />`
  - `<SettingsScreen trips activeTrip onSelectTrip />`

- [ ] **Step 1: 旅行選択の失敗するテストを書く**

`src/app/useActiveTrip.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Trip } from '../domain/types';
import { pickActiveTrip } from './useActiveTrip';

function trip(id: string): Trip {
  return {
    id,
    name: id,
    currency: 'CNY',
    currencyDecimals: 2,
    startDate: '2026-09-12',
    endDate: null,
    budgetJpy: null,
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
```

- [ ] **Step 2: 実行して失敗を確認する**

```bash
npx vitest run src/app/useActiveTrip.test.ts
```

期待: `Failed to resolve import "./useActiveTrip"` で失敗する。

- [ ] **Step 3: 実装する**

`src/app/useActiveTrip.ts`:

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { listTrips } from '../data/tripRepo';
import type { Trip } from '../domain/types';

const STORAGE_KEY = 'trip-wallet:active-trip';

// Safari のプライベートモードでは localStorage が例外を投げることがある
function readStoredTripId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTripId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 保存できなくても動作は続ける
  }
}

/** 保存された旅行が削除されていたら先頭(いちばん新しい旅行)に落とす。 */
export function pickActiveTrip(trips: Trip[], storedId: string | null): Trip | null {
  if (trips.length === 0) return null;
  return trips.find((t) => t.id === storedId) ?? trips[0];
}

export function useActiveTrip(): {
  trips: Trip[];
  activeTrip: Trip | null;
  loading: boolean;
  selectTrip: (id: string) => void;
} {
  const trips = useLiveQuery(() => listTrips(), []);
  const [storedId, setStoredId] = useState<string | null>(() => readStoredTripId());

  const selectTrip = useCallback((id: string) => {
    storeTripId(id);
    setStoredId(id);
  }, []);

  const loading = trips === undefined;
  const activeTrip = loading ? null : pickActiveTrip(trips, storedId);

  useEffect(() => {
    if (activeTrip && activeTrip.id !== storedId) selectTrip(activeTrip.id);
  }, [activeTrip, storedId, selectTrip]);

  return { trips: trips ?? [], activeTrip, loading, selectTrip };
}
```

- [ ] **Step 4: ボトムシートの器を作る**

`src/ui/Sheet.tsx`:

```tsx
import type { ReactNode } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ title, onClose, children }: Props) {
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 旅行フォームの失敗するテストを書く**

`src/ui/TripForm.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { createTrip, listTrips, getTrip } from '../data/tripRepo';
import { TripForm } from './TripForm';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('TripForm', () => {
  it('入力した内容で旅行を作る', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('旅行名'), '上海 2026-09');
    await user.selectOptions(screen.getByLabelText('通貨'), 'CNY');
    await user.clear(screen.getByLabelText('人数'));
    await user.type(screen.getByLabelText('人数'), '2');
    await user.type(screen.getByLabelText('予算(円)'), '100000');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const trips = await listTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].name).toBe('上海 2026-09');
    expect(trips[0].currency).toBe('CNY');
    expect(trips[0].currencyDecimals).toBe(2);
    expect(trips[0].memberCount).toBe(2);
    expect(trips[0].budgetJpy).toBe(100000);
  });

  it('旅行名が空なら保存しない', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm onDone={onDone} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('旅行名を入力してください')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(await listTrips()).toEqual([]);
  });

  it('既存の旅行を編集する', async () => {
    const trip = await createTrip({ name: '上海', currency: 'CNY' });
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<TripForm trip={trip} onDone={onDone} onCancel={() => {}} />);

    const name = screen.getByLabelText('旅行名');
    await user.clear(name);
    await user.type(name, '上海 2026 秋');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect((await getTrip(trip.id))?.name).toBe('上海 2026 秋');
    expect(await listTrips()).toHaveLength(1);
  });
});
```

- [ ] **Step 6: 実行して失敗を確認する**

```bash
npx vitest run src/ui/TripForm.test.tsx
```

期待: `Failed to resolve import "./TripForm"` で失敗する。

- [ ] **Step 7: 旅行フォームを実装する**

`src/ui/TripForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { createTrip, updateTrip } from '../data/tripRepo';
import { CURRENCIES } from '../domain/currency';
import { todayLocal } from '../domain/date';
import type { Trip } from '../domain/types';

type Props = {
  trip?: Trip;
  onDone: () => void;
  onCancel: () => void;
};

export function TripForm({ trip, onDone, onCancel }: Props) {
  const [name, setName] = useState(trip?.name ?? '');
  const [currency, setCurrency] = useState(trip?.currency ?? 'CNY');
  const [startDate, setStartDate] = useState(trip?.startDate ?? todayLocal());
  const [endDate, setEndDate] = useState(trip?.endDate ?? '');
  const [budget, setBudget] = useState(trip?.budgetJpy === null || trip === undefined ? '' : String(trip.budgetJpy));
  const [memberCount, setMemberCount] = useState(String(trip?.memberCount ?? 1));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') {
      setError('旅行名を入力してください');
      return;
    }

    setSaving(true);
    const input = {
      name: name.trim(),
      currency,
      startDate,
      endDate: endDate === '' ? null : endDate,
      budgetJpy: budget.trim() === '' ? null : Math.max(0, Math.round(Number(budget))),
      memberCount: Math.max(1, Math.round(Number(memberCount) || 1)),
    };

    try {
      if (trip) await updateTrip(trip.id, input);
      else await createTrip(input);
      onDone();
    } catch {
      setError('保存できませんでした');
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label htmlFor="trip-name">旅行名</label>
      <input
        id="trip-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="上海 2026-09"
      />

      <label htmlFor="trip-currency">通貨</label>
      <select id="trip-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}({c.code})
          </option>
        ))}
      </select>

      <label htmlFor="trip-start">開始日</label>
      <input
        id="trip-start"
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      <label htmlFor="trip-end">終了日</label>
      <input
        id="trip-end"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
      />

      <label htmlFor="trip-budget">予算(円)</label>
      <input
        id="trip-budget"
        inputMode="numeric"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        placeholder="未設定"
      />

      <label htmlFor="trip-members">人数</label>
      <input
        id="trip-members"
        inputMode="numeric"
        value={memberCount}
        onChange={(e) => setMemberCount(e.target.value)}
      />

      {error !== '' && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          保存
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 8: 設定画面を実装する**

`src/ui/SettingsScreen.tsx`:

```tsx
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
    const json = serializeBackup(await exportBackup());
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    a.click();
    URL.revokeObjectURL(url);
    setMessage('バックアップを書き出しました');
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
                  {trip.budgetJpy !== null ? ` / 予算 ${formatJpy(trip.budgetJpy)}` : ''}
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
```

- [ ] **Step 9: `App.tsx` を差し替える**

`src/app/App.tsx`(全文を置き換える):

```tsx
import { SettingsScreen } from '../ui/SettingsScreen';
import { useActiveTrip } from './useActiveTrip';

export function App() {
  const { trips, activeTrip, loading, selectTrip } = useActiveTrip();

  if (loading) {
    return (
      <main className="screen">
        <p className="empty">読み込み中…</p>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="app-header">
        <h1>Trip Wallet</h1>
      </header>
      <SettingsScreen trips={trips} activeTrip={activeTrip} onSelectTrip={selectTrip} />
    </main>
  );
}
```

- [ ] **Step 10: スタイルを追記する**

`src/styles.css` の末尾に追記:

```css
.screen {
  max-width: 640px;
  margin: 0 auto;
  padding: 12px 12px 88px;
}

.app-header h1 {
  font-size: 18px;
  margin: 8px 0 16px;
}

.empty,
.hint {
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.6;
}

.error {
  color: var(--danger);
  font-size: 13px;
}

section {
  margin-bottom: 28px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h3 {
  font-size: 15px;
  margin: 0 0 8px;
}

.btn-primary,
.btn-ghost,
.btn-danger {
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 14px;
  min-height: 40px;
}

.btn-primary {
  background: var(--accent);
  color: #062033;
  font-weight: 600;
}

.btn-ghost {
  background: var(--surface-2);
}

.btn-danger {
  background: transparent;
  color: var(--danger);
}

.btn-primary:disabled {
  opacity: 0.5;
}

.file-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.file-label input {
  display: none;
}

.trip-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.trip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 10px 12px;
  margin-bottom: 8px;
}

.trip.active {
  outline: 2px solid var(--accent);
}

.trip-main {
  flex: 1;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.trip-name {
  font-weight: 600;
}

.trip-meta {
  font-size: 12px;
  color: var(--text-dim);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form label {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 8px;
}

.form input,
.form select {
  background: var(--surface-2);
  border: none;
  border-radius: 10px;
  padding: 12px;
  color: var(--text);
  font-size: 16px; /* iOS で入力時に拡大されないよう 16px 以上にする */
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-actions .btn-primary {
  flex: 1;
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 20;
}

.sheet {
  background: var(--bg);
  width: 100%;
  max-width: 640px;
  max-height: 92vh;
  overflow-y: auto;
  border-radius: 20px 20px 0 0;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-header h2 {
  font-size: 16px;
  margin: 4px 0 8px;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  background: var(--surface-2);
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 13px;
  z-index: 30;
}
```

- [ ] **Step 11: 実行して通過を確認する**

```bash
npm run test
```

期待: `useActiveTrip` と `TripForm` を含めすべて PASS。

- [ ] **Step 12: ビルドを確認する**

```bash
npm run build
```

期待: 型エラーなし。

- [ ] **Step 13: コミット**

```bash
git add -A && git commit -m "feat: 旅行の管理と設定画面を追加"
```

---

### Task 9: 支出の入力シートと自前テンキー

**Files:**
- Create: `src/ui/Numpad.tsx`, `src/ui/ExpenseSheet.tsx`
- Modify: `src/styles.css`(末尾に追記)
- Test: `src/ui/Numpad.test.tsx`, `src/ui/ExpenseSheet.test.tsx`

**Interfaces:**
- Consumes: `addExpense` / `updateExpense`(Task 4)、`savePhoto`(Task 4)、`compressImage`(Task 6)、`resolveRate`(Task 5)、`parseMajorToMinor` / `minorToMajor` / `toJpy` / `formatJpy`(Task 2)、`currencySymbol`(Task 2)、`CATEGORIES` / `PAYMENTS` / `SCOPES`(Task 3)、`todayLocal` / `formatDateLabel`(Task 1)、`Sheet`(Task 8)
- Produces:
  - `pressKey(value: string, key: NumpadKey, decimals: number): string`
  - `<Numpad value decimals onChange />`
  - `<ExpenseSheet trip: Trip expense?: Expense onClose: (message?: string) => void />`

- [ ] **Step 1: テンキーの失敗するテストを書く**

`src/ui/Numpad.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Numpad, pressKey } from './Numpad';

describe('pressKey', () => {
  it('数字を末尾に足す', () => {
    expect(pressKey('', '1', 2)).toBe('1');
    expect(pressKey('12', '3', 2)).toBe('123');
  });

  it('先頭の 0 は次の数字で置き換える', () => {
    expect(pressKey('0', '5', 2)).toBe('5');
    expect(pressKey('0', '0', 2)).toBe('0');
  });

  it('小数点が無いところに . を押すと 0. になる', () => {
    expect(pressKey('', '.', 2)).toBe('0.');
    expect(pressKey('12', '.', 2)).toBe('12.');
  });

  it('小数点は 1 つまで', () => {
    expect(pressKey('12.3', '.', 2)).toBe('12.3');
  });

  it('小数桁が 0 の通貨では . を無視する', () => {
    expect(pressKey('15000', '.', 0)).toBe('15000');
  });

  it('小数部が桁数に達したら足さない', () => {
    expect(pressKey('12.34', '5', 2)).toBe('12.34');
    expect(pressKey('12.3', '4', 2)).toBe('12.34');
  });

  it('整数部は 9 桁まで', () => {
    expect(pressKey('123456789', '0', 2)).toBe('123456789');
  });

  it('del で末尾を削る', () => {
    expect(pressKey('12.3', 'del', 2)).toBe('12.');
    expect(pressKey('1', 'del', 2)).toBe('');
    expect(pressKey('', 'del', 2)).toBe('');
  });
});

describe('Numpad', () => {
  it('押したキーを onChange に渡す', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Numpad value="1" decimals={2} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(onChange).toHaveBeenCalledWith('12');
  });

  it('小数桁が 0 の通貨では . を押せない', () => {
    render(<Numpad value="" decimals={0} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '.' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: 実行して失敗を確認する**

```bash
npx vitest run src/ui/Numpad.test.tsx
```

期待: `Failed to resolve import "./Numpad"` で失敗する。

- [ ] **Step 3: テンキーを実装する**

`src/ui/Numpad.tsx`:

```tsx
export type NumpadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'del';

const MAX_INT_DIGITS = 9;

/** テンキーの 1 打鍵を金額文字列に適用する。数字文字列だけを扱い、丸めや換算はしない。 */
export function pressKey(value: string, key: NumpadKey, decimals: number): string {
  if (key === 'del') return value.slice(0, -1);

  if (key === '.') {
    if (decimals === 0 || value.includes('.')) return value;
    return value === '' ? '0.' : `${value}.`;
  }

  const [intPart, decPart] = value.split('.');
  if (decPart === undefined) {
    if (value === '0') return key;
    if (intPart.length >= MAX_INT_DIGITS) return value;
    return value + key;
  }

  if (decPart.length >= decimals) return value;
  return value + key;
}

const KEYS: NumpadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

type Props = {
  value: string;
  decimals: number;
  onChange: (next: string) => void;
};

export function Numpad({ value, decimals, onChange }: Props) {
  return (
    <div className="numpad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="numpad-key"
          aria-label={key === 'del' ? '1 文字削除' : key}
          disabled={key === '.' && decimals === 0}
          onClick={() => onChange(pressKey(value, key, decimals))}
        >
          {key === 'del' ? '⌫' : key}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 入力シートの失敗するテストを書く**

`src/ui/ExpenseSheet.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../data/db';
import { listExpenses } from '../data/expenseRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { resolveRate } from '../rates/resolveRate';
import { ExpenseSheet } from './ExpenseSheet';

vi.mock('../rates/resolveRate', () => ({
  resolveRate: vi.fn(),
  prefetchTodayRate: vi.fn(),
}));

let trip: Trip;

beforeEach(async () => {
  await db.delete();
  await db.open();
  localStorage.clear();
  vi.mocked(resolveRate).mockReset();
  trip = await createTrip({ name: '上海', currency: 'CNY', memberCount: 2 });
});

describe('ExpenseSheet', () => {
  it('金額とカテゴリを選んで保存すると、レートを焼き付けた支出ができる', async () => {
    vi.mocked(resolveRate).mockResolvedValue({
      rate: 23.465,
      effectiveDate: '2026-09-11',
      source: 'api',
      stale: false,
    });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} onClose={onClose} />);

    await screen.findByText(/23\.465/);
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '0' }));

    expect(screen.getByTestId('jpy-preview')).toHaveTextContent('¥2,816');

    await user.click(screen.getByRole('button', { name: /交通/ }));
    await user.click(screen.getByRole('button', { name: '共有' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await listExpenses(trip.id);
    expect(saved).toHaveLength(1);
    expect(saved[0].amountMinor).toBe(12000);
    expect(saved[0].rate).toBe(23.465);
    expect(saved[0].rateSource).toBe('api');
    expect(saved[0].category).toBe('transport');
    expect(saved[0].scope).toBe('shared');
    expect(saved[0].payment).toBe('cash');
  });

  it('レートを解決できないときは手動入力しないと保存できない', async () => {
    vi.mocked(resolveRate).mockResolvedValue(null);
    const user = userEvent.setup();
    render(<ExpenseSheet trip={trip} onClose={vi.fn()} />);

    expect(
      await screen.findByText('レートを取得できません。手動で入力してください'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('レートを入力してください')).toBeInTheDocument();
    expect(await listExpenses(trip.id)).toEqual([]);
  });

  it('レートを手動で上書きすると manual として保存される', async () => {
    vi.mocked(resolveRate).mockResolvedValue({
      rate: 23.465,
      effectiveDate: '2026-09-12',
      source: 'api',
      stale: false,
    });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExpenseSheet trip={trip} onClose={onClose} />);

    await screen.findByText(/23\.465/);
    await user.click(screen.getByRole('button', { name: 'レートを編集' }));
    const input = screen.getByLabelText('1元 = ? 円');
    await user.clear(input);
    await user.type(input, '24');
    await user.click(screen.getByRole('button', { name: 'レートを確定' }));

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = await listExpenses(trip.id);
    expect(saved[0].rate).toBe(24);
    expect(saved[0].rateSource).toBe('manual');
    expect(saved[0].amountMinor).toBe(1000);
  });

  it('直近レートしか無いときは使用中の日付を知らせる', async () => {
    vi.mocked(resolveRate).mockResolvedValue({
      rate: 23.4,
      effectiveDate: '2026-09-10',
      source: 'cache',
      stale: true,
    });
    render(<ExpenseSheet trip={trip} onClose={vi.fn()} />);

    expect(await screen.findByText(/9\/10.*時点のレートを使用中/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: 実行して失敗を確認する**

```bash
npx vitest run src/ui/ExpenseSheet.test.tsx
```

期待: `Failed to resolve import "./ExpenseSheet"` で失敗する。

- [ ] **Step 6: 入力シートを実装する**

`src/ui/ExpenseSheet.tsx`:

```tsx
import { useEffect, useState, type ChangeEvent } from 'react';
import { addExpense, updateExpense } from '../data/expenseRepo';
import { savePhoto } from '../data/photoRepo';
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

type AutoRate = { rate: number; source: RateSource; note: string };

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

  const [autoRate, setAutoRate] = useState<AutoRate | null>(
    expense && expense.rateSource !== 'manual'
      ? { rate: expense.rate, source: expense.rateSource, note: '記録時のレート' }
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
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');

  // 保存済みのレートは焼き付いた値を保つ。日付を変えたときだけ取り直す。
  const keepSavedRate = expense !== undefined && date === expense.date;

  useEffect(() => {
    if (manualRate !== null || keepSavedRate) return;
    let cancelled = false;
    void resolveRate(trip.currency, date).then((r) => {
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
            },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [trip.currency, date, manualRate, keepSavedRate]);

  const rate = manualRate ?? autoRate?.rate ?? null;
  const rateSource: RateSource = manualRate !== null ? 'manual' : (autoRate?.source ?? 'api');
  const amountMinor = parseMajorToMinor(amount, decimals);
  const jpy = rate === null ? null : toJpy(amountMinor, decimals, rate);

  function confirmRate() {
    const n = Number(rateInput);
    if (!Number.isFinite(n) || n <= 0) {
      setError('レートは 0 より大きい数で入力してください');
      return;
    }
    setManualRate(n);
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
    let warning = '';
    if (photoFile) {
      try {
        nextPhotoId = await savePhoto(await compressImage(photoFile));
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
      if (manualRate !== null) storeManualRate(trip.id, manualRate);
      onClose(warning === '' ? '保存しました' : warning);
    } catch {
      setError('保存できませんでした');
      setSaving(false);
    }
  }

  return (
    <Sheet title={expense ? '支出を編集' : '支出を追加'} onClose={() => onClose()}>
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
            <span className={autoRate?.note.includes('使用中') ? 'rate-note stale' : 'rate-note'}>
              {rate === null
                ? autoLoaded
                  ? 'レートを取得できません。手動で入力してください'
                  : 'レートを取得中…'
                : `1${symbol} = ${rate}円(${manualRate !== null ? '手動' : (autoRate?.note ?? '')})`}
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
        <button type="button" className="btn-ghost" onClick={() => onClose()}>
          キャンセル
        </button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
          保存
        </button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 7: スタイルを追記する**

`src/styles.css` の末尾に追記:

```css
.amount-display {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8px 4px 12px;
}

.amount-major {
  font-size: 34px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.amount-jpy {
  font-size: 18px;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.rate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
  margin-bottom: 12px;
}

.rate-note {
  color: var(--text-dim);
  flex: 1;
}

.rate-note.stale {
  color: var(--danger);
}

.rate-row input {
  background: var(--surface-2);
  border: none;
  border-radius: 10px;
  padding: 10px;
  color: var(--text);
  font-size: 16px;
  width: 100px;
}

.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.numpad-key {
  background: var(--surface-2);
  border-radius: 12px;
  font-size: 22px;
  padding: 14px 0;
  min-height: 56px;
}

.numpad-key:disabled {
  opacity: 0.3;
}

.segment {
  display: flex;
  background: var(--surface-2);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 12px;
}

.seg {
  flex: 1;
  padding: 10px;
  border-radius: 9px;
  font-size: 15px;
  color: var(--text-dim);
}

.seg.active {
  background: var(--accent);
  color: #062033;
  font-weight: 600;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.cat {
  background: var(--surface-2);
  border-radius: 12px;
  padding: 10px 4px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 64px;
}

.cat.active {
  outline: 2px solid var(--accent);
}

.cat-icon {
  font-size: 20px;
}

.chips {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.chip {
  flex: 1;
  background: var(--surface-2);
  border-radius: 999px;
  padding: 10px 8px;
  font-size: 13px;
}

.chip.active {
  outline: 2px solid var(--accent);
}
```

- [ ] **Step 8: 実行して通過を確認する**

```bash
npm run test
```

期待: `Numpad` と `ExpenseSheet` を含めすべて PASS。

**Note:** 写真の圧縮(`compressImage`)は canvas を使うため jsdom では動かせない。この経路の確認は Task 12 の手動確認チェックリストで行う。

- [ ] **Step 9: ビルドを確認する**

```bash
npm run build
```

期待: 型エラーなし。

- [ ] **Step 10: コミット**

```bash
git add -A && git commit -m "feat: 支出の入力シートと自前テンキーを追加"
```

---

### Task 10: ホーム画面とタブ切り替え

**Files:**
- Create: `src/ui/HomeScreen.tsx`
- Modify: `src/app/App.tsx`(タブバーを導入)、`src/styles.css`(末尾に追記)
- Test: `src/ui/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `listExpenses` / `deleteExpense` / `getPhoto`(Task 4)、`summarize` / `groupByDate` / `expenseJpy`(Task 3)、`formatJpy` / `formatWithCurrency`(Task 2)、`categoryIcon` / `categoryLabel` / `scopeLabel`(Task 3)、`formatDateLabel`(Task 1)、`ExpenseSheet`(Task 9)
- Produces: `<HomeScreen trip: Trip />`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/HomeScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '../data/db';
import { addExpense } from '../data/expenseRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { HomeScreen } from './HomeScreen';

let trip: Trip;

beforeEach(async () => {
  await db.delete();
  await db.open();
  trip = await createTrip({
    name: '上海',
    currency: 'CNY',
    memberCount: 2,
    budgetJpy: 10000,
  });
  await addExpense({
    tripId: trip.id,
    date: '2026-09-12',
    amountMinor: 12000, // 120.00 元
    scope: 'personal',
    category: 'food',
    payment: 'cash',
    memo: '小籠包',
    rate: 23.465,
    rateSource: 'api',
    photoId: null,
  });
  await addExpense({
    tripId: trip.id,
    date: '2026-09-11',
    amountMinor: 10000, // 100.00 元
    scope: 'shared',
    category: 'transport',
    payment: 'mobile',
    memo: 'タクシー',
    rate: 23,
    rateSource: 'api',
    photoId: null,
  });
});

describe('HomeScreen', () => {
  it('サマリーを表示する', async () => {
    render(<HomeScreen trip={trip} />);

    expect(await screen.findByTestId('total-jpy')).toHaveTextContent('¥5,116');
    expect(screen.getByTestId('personal-jpy')).toHaveTextContent('¥2,816');
    expect(screen.getByTestId('shared-jpy')).toHaveTextContent('¥2,300');
    expect(screen.getByTestId('shared-per-person')).toHaveTextContent('¥1,150');
    expect(screen.getByTestId('remaining-jpy')).toHaveTextContent('¥4,884');
  });

  it('日付ごとに支出を並べる', async () => {
    render(<HomeScreen trip={trip} />);

    expect(await screen.findByText('9/12(土)')).toBeInTheDocument();
    expect(screen.getByText('9/11(金)')).toBeInTheDocument();
    expect(screen.getByText('小籠包')).toBeInTheDocument();
    expect(screen.getByText('120.00元 → ¥2,816')).toBeInTheDocument();
    expect(screen.getByText('100.00元 → ¥2,300')).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['9/12(土)', '9/11(金)']);
  });

  it('支出が無ければ案内を出す', async () => {
    const empty = await createTrip({ name: '香港', currency: 'HKD' });
    render(<HomeScreen trip={empty} />);

    expect(await screen.findByText('まだ支出がありません。右下の + から追加してください。')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 実行して失敗を確認する**

```bash
npx vitest run src/ui/HomeScreen.test.tsx
```

期待: `Failed to resolve import "./HomeScreen"` で失敗する。

- [ ] **Step 3: ホーム画面を実装する**

`src/ui/HomeScreen.tsx`:

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { deleteExpense, listExpenses } from '../data/expenseRepo';
import { getPhoto } from '../data/photoRepo';
import { categoryIcon, categoryLabel, scopeLabel } from '../domain/categories';
import { formatDateLabel } from '../domain/date';
import { formatJpy, formatWithCurrency } from '../domain/money';
import { expenseJpy, groupByDate, summarize } from '../domain/summary';
import type { Expense, Trip } from '../domain/types';
import { ExpenseSheet } from './ExpenseSheet';

function PhotoThumb({ photoId }: { photoId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void getPhoto(photoId).then((blob) => {
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  return url === null ? null : <img className="thumb" src={url} alt="レシート" />;
}

export function HomeScreen({ trip }: { trip: Trip }) {
  const expenses = useLiveQuery(() => listExpenses(trip.id), [trip.id]);
  const [sheet, setSheet] = useState<Expense | 'new' | null>(null);
  const [message, setMessage] = useState('');

  const list = expenses ?? [];
  const summary = summarize(list, trip);
  const groups = groupByDate(list, trip);
  const usedRatio =
    summary.budgetJpy === null || summary.budgetJpy === 0
      ? 0
      : Math.min(1, summary.totalJpy / summary.budgetJpy);

  async function handleDelete(e: Expense) {
    if (!confirm('この支出を削除しますか?')) return;
    await deleteExpense(e.id);
    setMessage('削除しました');
  }

  return (
    <div className="home">
      <div className="card">
        <div className="card-total">
          <span className="card-label">合計</span>
          <span className="card-jpy" data-testid="total-jpy">
            {formatJpy(summary.totalJpy)}
          </span>
          <span className="card-foreign">
            {formatWithCurrency(summary.totalMinor, trip.currency)} / {summary.count}件
          </span>
        </div>

        <div className="card-split">
          <div>
            <span className="card-label">個別</span>
            <span data-testid="personal-jpy">{formatJpy(summary.personalJpy)}</span>
          </div>
          <div>
            <span className="card-label">共有</span>
            <span data-testid="shared-jpy">{formatJpy(summary.sharedJpy)}</span>
            <span className="card-sub" data-testid="shared-per-person">
              自分の負担 {formatJpy(summary.sharedPerPersonJpy)}({trip.memberCount}人)
            </span>
          </div>
        </div>

        {summary.budgetJpy !== null && summary.remainingJpy !== null && (
          <div className="budget">
            <div className="budget-bar">
              <div
                className={usedRatio >= 1 ? 'budget-fill over' : 'budget-fill'}
                style={{ width: `${usedRatio * 100}%` }}
              />
            </div>
            <span className="card-sub" data-testid="remaining-jpy">
              予算 {formatJpy(summary.budgetJpy)} / 残り {formatJpy(summary.remainingJpy)}
            </span>
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <p className="empty">まだ支出がありません。右下の + から追加してください。</p>
      )}

      {groups.map((group) => (
        <section key={group.date} className="day">
          <div className="day-head">
            <h3>{formatDateLabel(group.date)}</h3>
            <span className="card-sub">{formatJpy(group.jpy)}</span>
          </div>
          <ul className="ex-list">
            {group.expenses.map((e) => (
              <li key={e.id} className="ex-row">
                <button type="button" className="ex-main" onClick={() => setSheet(e)}>
                  <span className="ex-icon">{categoryIcon(e.category)}</span>
                  <span className="ex-text">
                    <span className="ex-memo">
                      {e.memo === '' ? categoryLabel(e.category) : e.memo}
                    </span>
                    <span className="ex-sub">
                      {formatWithCurrency(e.amountMinor, trip.currency)} →{' '}
                      {formatJpy(expenseJpy(e, trip))}
                    </span>
                  </span>
                  <span className={e.scope === 'shared' ? 'badge shared' : 'badge'}>
                    {scopeLabel(e.scope)}
                  </span>
                </button>
                {e.photoId !== null && <PhotoThumb photoId={e.photoId} />}
                <button
                  type="button"
                  className="btn-danger"
                  aria-label="削除"
                  onClick={() => handleDelete(e)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <button type="button" className="fab" aria-label="支出を追加" onClick={() => setSheet('new')}>
        ＋
      </button>

      {message !== '' && <p className="toast">{message}</p>}

      {sheet !== null && (
        <ExpenseSheet
          trip={trip}
          expense={sheet === 'new' ? undefined : sheet}
          onClose={(m) => {
            setSheet(null);
            if (m) setMessage(m);
          }}
        />
      )}
    </div>
  );
}
```

**Note:** 支出リストの日付見出しは `formatDateLabel` の出力(`9/12(土)`)をそのまま使う。テストが期待する曜日は 2026-09-12 = 土曜、2026-09-11 = 金曜。

- [ ] **Step 4: `App.tsx` にタブバーを入れる**

`src/app/App.tsx`(全文を置き換える):

```tsx
import { useState } from 'react';
import { HomeScreen } from '../ui/HomeScreen';
import { SettingsScreen } from '../ui/SettingsScreen';
import { useActiveTrip } from './useActiveTrip';

type Tab = 'home' | 'settings';

export function App() {
  const { trips, activeTrip, loading, selectTrip } = useActiveTrip();
  const [tab, setTab] = useState<Tab>('home');

  if (loading) {
    return (
      <main className="screen">
        <p className="empty">読み込み中…</p>
      </main>
    );
  }

  return (
    <>
      <main className="screen">
        <header className="app-header">
          <h1>{activeTrip?.name ?? 'Trip Wallet'}</h1>
        </header>

        {tab === 'home' &&
          (activeTrip !== null ? (
            <HomeScreen trip={activeTrip} />
          ) : (
            <p className="empty">まず「設定」タブで旅行を作成してください。</p>
          ))}

        {tab === 'settings' && (
          <SettingsScreen trips={trips} activeTrip={activeTrip} onSelectTrip={selectTrip} />
        )}
      </main>

      <nav className="tabbar">
        <button
          type="button"
          className={tab === 'home' ? 'tab active' : 'tab'}
          onClick={() => setTab('home')}
        >
          🏠 ホーム
        </button>
        <button
          type="button"
          className={tab === 'settings' ? 'tab active' : 'tab'}
          onClick={() => setTab('settings')}
        >
          ⚙️ 設定
        </button>
      </nav>
    </>
  );
}
```

- [ ] **Step 5: スタイルを追記する**

`src/styles.css` の末尾に追記:

```css
.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 16px;
}

.card-total {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-label {
  font-size: 12px;
  color: var(--text-dim);
  display: block;
}

.card-jpy {
  font-size: 30px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.card-foreign,
.card-sub {
  font-size: 12px;
  color: var(--text-dim);
  display: block;
}

.card-split {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.card-split > div {
  flex: 1;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 8px 10px;
  font-variant-numeric: tabular-nums;
}

.budget {
  margin-top: 12px;
}

.budget-bar {
  height: 8px;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 4px;
}

.budget-fill {
  height: 100%;
  background: var(--ok);
}

.budget-fill.over {
  background: var(--danger);
}

.day {
  margin-bottom: 16px;
}

.day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ex-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ex-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 8px 10px;
  margin-bottom: 6px;
}

.ex-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.ex-icon {
  font-size: 20px;
}

.ex-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ex-memo {
  font-size: 14px;
}

.ex-sub {
  font-size: 12px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-dim);
}

.badge.shared {
  background: var(--accent);
  color: #062033;
}

.thumb {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 8px;
}

.fab {
  position: fixed;
  right: 16px;
  bottom: calc(72px + env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent);
  color: #062033;
  font-size: 28px;
  z-index: 10;
}

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  background: var(--surface);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 15;
}

.tab {
  flex: 1;
  padding: 12px 0;
  font-size: 13px;
  color: var(--text-dim);
}

.tab.active {
  color: var(--accent);
  font-weight: 600;
}
```

- [ ] **Step 6: 実行して通過を確認する**

```bash
npm run test
```

期待: `HomeScreen` を含めすべて PASS。

- [ ] **Step 7: ビルドを確認する**

```bash
npm run build
```

期待: 型エラーなし。

- [ ] **Step 8: コミット**

```bash
git add -A && git commit -m "feat: ホーム画面とタブ切り替えを追加"
```

---

### Task 11: 集計画面

**Files:**
- Create: `src/ui/SummaryScreen.tsx`
- Modify: `src/app/App.tsx`(集計タブを追加)、`src/styles.css`(末尾に追記)
- Test: `src/ui/SummaryScreen.test.tsx`

**Interfaces:**
- Consumes: `listExpenses`(Task 4)、`summarize` / `breakdownByCategory` / `totalsByDate`(Task 3)、`categoryIcon` / `categoryLabel`(Task 3)、`formatJpy` / `formatWithCurrency`(Task 2)、`formatDateLabel`(Task 1)
- Produces: `<SummaryScreen trip: Trip />`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/SummaryScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { db } from '../data/db';
import { addExpense } from '../data/expenseRepo';
import { createTrip } from '../data/tripRepo';
import type { Trip } from '../domain/types';
import { SummaryScreen } from './SummaryScreen';

let trip: Trip;

beforeEach(async () => {
  await db.delete();
  await db.open();
  trip = await createTrip({ name: '上海', currency: 'CNY', memberCount: 2 });
  await addExpense({
    tripId: trip.id,
    date: '2026-09-12',
    amountMinor: 12000, // 120.00 元 × 23.465 = ¥2,816
    scope: 'personal',
    category: 'food',
    payment: 'cash',
    memo: '小籠包',
    rate: 23.465,
    rateSource: 'api',
    photoId: null,
  });
  await addExpense({
    tripId: trip.id,
    date: '2026-09-11',
    amountMinor: 10000, // 100.00 元 × 23 = ¥2,300
    scope: 'shared',
    category: 'transport',
    payment: 'mobile',
    memo: 'タクシー',
    rate: 23,
    rateSource: 'api',
    photoId: null,
  });
});

describe('SummaryScreen', () => {
  it('個別・共有・人数割りを表示する', async () => {
    render(<SummaryScreen trip={trip} />);

    expect(await screen.findByTestId('summary-total')).toHaveTextContent('¥5,116');
    expect(screen.getByTestId('summary-personal')).toHaveTextContent('¥2,816');
    expect(screen.getByTestId('summary-shared')).toHaveTextContent('¥2,300');
    expect(screen.getByTestId('summary-share-note')).toHaveTextContent('自分の負担 ¥1,150(2人)');
    expect(screen.getByTestId('summary-mine')).toHaveTextContent('¥3,966');
  });

  it('カテゴリ別を金額の多い順に並べる', async () => {
    render(<SummaryScreen trip={trip} />);

    const rows = await screen.findAllByTestId('cat-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('食事');
    expect(rows[0]).toHaveTextContent('¥2,816');
    expect(rows[0]).toHaveTextContent('55%');
    expect(rows[1]).toHaveTextContent('交通');
    expect(rows[1]).toHaveTextContent('¥2,300');
    expect(rows[1]).toHaveTextContent('45%');
  });

  it('日別推移を古い順に並べる', async () => {
    render(<SummaryScreen trip={trip} />);

    const rows = await screen.findAllByTestId('day-row');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('9/11(金)'),
      expect.stringContaining('9/12(土)'),
    ]);
    expect(rows[0]).toHaveTextContent('¥2,300');
    expect(rows[1]).toHaveTextContent('¥2,816');
  });

  it('支出が無ければ案内を出す', async () => {
    const empty = await createTrip({ name: '香港', currency: 'HKD' });
    render(<SummaryScreen trip={empty} />);

    expect(await screen.findByText('集計する支出がまだありません。')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 実行して失敗を確認する**

```bash
npx vitest run src/ui/SummaryScreen.test.tsx
```

期待: `Failed to resolve import "./SummaryScreen"` で失敗する。

- [ ] **Step 3: 集計画面を実装する**

`src/ui/SummaryScreen.tsx`:

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { listExpenses } from '../data/expenseRepo';
import { categoryIcon, categoryLabel } from '../domain/categories';
import { formatDateLabel } from '../domain/date';
import { formatJpy, formatWithCurrency } from '../domain/money';
import { breakdownByCategory, summarize, totalsByDate } from '../domain/summary';
import type { Trip } from '../domain/types';

export function SummaryScreen({ trip }: { trip: Trip }) {
  const expenses = useLiveQuery(() => listExpenses(trip.id), [trip.id]);
  const list = expenses ?? [];
  const summary = summarize(list, trip);
  const categories = breakdownByCategory(list, trip);
  const days = totalsByDate(list, trip);
  const maxDayJpy = days.reduce((max, d) => Math.max(max, d.jpy), 1);

  if (list.length === 0) {
    return <p className="empty">集計する支出がまだありません。</p>;
  }

  return (
    <div className="summary">
      <section>
        <h3>合計</h3>
        <div className="card">
          <span className="card-jpy" data-testid="summary-total">
            {formatJpy(summary.totalJpy)}
          </span>
          <span className="card-foreign">
            {formatWithCurrency(summary.totalMinor, trip.currency)} / {summary.count}件
          </span>
          <div className="card-split">
            <div>
              <span className="card-label">個別</span>
              <span data-testid="summary-personal">{formatJpy(summary.personalJpy)}</span>
            </div>
            <div>
              <span className="card-label">共有</span>
              <span data-testid="summary-shared">{formatJpy(summary.sharedJpy)}</span>
              <span className="card-sub" data-testid="summary-share-note">
                自分の負担 {formatJpy(summary.sharedPerPersonJpy)}({trip.memberCount}人)
              </span>
            </div>
          </div>
          <p className="card-sub">
            自分の負担合計:{' '}
            <strong data-testid="summary-mine">{formatJpy(summary.myTotalJpy)}</strong>
            (個別 + 共有の人数割り)
          </p>
        </div>
      </section>

      <section>
        <h3>カテゴリ別</h3>
        {categories.map((c) => (
          <div className="cat-row" data-testid="cat-row" key={c.category}>
            <span className="cat-row-name">
              {categoryIcon(c.category)} {categoryLabel(c.category)}
            </span>
            <div className="cat-bar">
              <div className="cat-fill" style={{ width: `${c.ratio * 100}%` }} />
            </div>
            <span className="cat-row-value">
              {formatJpy(c.jpy)} / {Math.round(c.ratio * 100)}%
            </span>
          </div>
        ))}
      </section>

      <section>
        <h3>日別推移</h3>
        {days.map((d) => (
          <div className="cat-row" data-testid="day-row" key={d.date}>
            <span className="cat-row-name">{formatDateLabel(d.date)}</span>
            <div className="cat-bar">
              <div className="cat-fill" style={{ width: `${(d.jpy / maxDayJpy) * 100}%` }} />
            </div>
            <span className="cat-row-value">{formatJpy(d.jpy)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: `App.tsx` に集計タブを追加する**

`src/app/App.tsx` の 3 か所を編集する。

1. import を追加:

```tsx
import { SummaryScreen } from '../ui/SummaryScreen';
```

2. `type Tab` を差し替える:

```tsx
type Tab = 'home' | 'summary' | 'settings';
```

3. `{tab === 'settings' && (...)}` の**直前**に集計タブの描画を挿入する:

```tsx
        {tab === 'summary' &&
          (activeTrip !== null ? (
            <SummaryScreen trip={activeTrip} />
          ) : (
            <p className="empty">まず「設定」タブで旅行を作成してください。</p>
          ))}
```

4. タブバーのホームボタンと設定ボタンの**間**にボタンを挿入する:

```tsx
        <button
          type="button"
          className={tab === 'summary' ? 'tab active' : 'tab'}
          onClick={() => setTab('summary')}
        >
          📊 集計
        </button>
```

- [ ] **Step 5: スタイルを追記する**

`src/styles.css` の末尾に追記:

```css
.cat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.cat-row-name {
  width: 88px;
  flex-shrink: 0;
}

.cat-row-value {
  width: 116px;
  flex-shrink: 0;
  text-align: right;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.cat-bar {
  flex: 1;
  height: 10px;
  background: var(--surface-2);
  border-radius: 999px;
  overflow: hidden;
}

.cat-fill {
  height: 100%;
  background: var(--accent);
}

.summary .card-jpy {
  display: block;
}
```

- [ ] **Step 6: 実行して通過を確認する**

```bash
npm run test
```

期待: `SummaryScreen` を含めすべて PASS。

- [ ] **Step 7: ビルドを確認する**

```bash
npm run build
```

期待: 型エラーなし。

- [ ] **Step 8: コミット**

```bash
git add -A && git commit -m "feat: 集計画面を追加"
```

---

### Task 12: PWA 化・データ保全・GitHub Pages への配布

**Files:**
- Create: `public/icon.svg`, `scripts/generate-icons.mjs`, `src/vite-env.d.ts`, `src/app/pwa.ts`, `src/app/reminders.ts`, `.github/workflows/deploy.yml`, `README.md`
- Generate: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`(スクリプトで作って commit する)
- Modify: `package.json`(依存と `icons` スクリプト)、`vite.config.ts`、`index.html`、`src/main.tsx`、`src/app/App.tsx`、`src/styles.css`
- Test: `src/app/reminders.test.ts`

**Interfaces:**
- Consumes: `Trip`(Task 2)、`todayLocal`(Task 1)
- Produces:
  - `needsExportReminder(trip: Trip | null, today: string, dismissedFor: string | null): boolean`
  - `readDismissedReminder(): string | null` / `dismissReminder(tripId: string): void`
  - `usePwaUpdate(): { needRefresh: boolean; updateApp: () => void }`
  - `requestPersistentStorage(): Promise<boolean>`

- [ ] **Step 1: 依存を追加する**

```bash
npm i -D vite-plugin-pwa sharp
```

`sharp` はアイコン PNG を作るためだけの開発依存で、アプリには含まれない。

- [ ] **Step 2: エクスポート促しの失敗するテストを書く**

`src/app/reminders.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type { Trip } from '../domain/types';
import { dismissReminder, needsExportReminder, readDismissedReminder } from './reminders';

function trip(patch: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    name: '上海',
    currency: 'CNY',
    currencyDecimals: 2,
    startDate: '2026-09-12',
    endDate: '2026-09-16',
    budgetJpy: null,
    memberCount: 1,
    createdAt: 0,
    ...patch,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('needsExportReminder', () => {
  it('旅行が無ければ出さない', () => {
    expect(needsExportReminder(null, '2026-09-20', null)).toBe(false);
  });

  it('終了日が未設定なら出さない', () => {
    expect(needsExportReminder(trip({ endDate: null }), '2026-09-20', null)).toBe(false);
  });

  it('終了日より前なら出さない', () => {
    expect(needsExportReminder(trip(), '2026-09-15', null)).toBe(false);
  });

  it('終了日当日なら出す', () => {
    expect(needsExportReminder(trip(), '2026-09-16', null)).toBe(true);
  });

  it('終了日を過ぎたら出す', () => {
    expect(needsExportReminder(trip(), '2026-09-20', null)).toBe(true);
  });

  it('一度閉じた旅行では出さない', () => {
    expect(needsExportReminder(trip(), '2026-09-20', 'trip-1')).toBe(false);
  });

  it('別の旅行を閉じていても出す', () => {
    expect(needsExportReminder(trip(), '2026-09-20', 'trip-9')).toBe(true);
  });
});

describe('閉じた状態の保存', () => {
  it('保存した旅行 id を読み戻せる', () => {
    expect(readDismissedReminder()).toBeNull();
    dismissReminder('trip-1');
    expect(readDismissedReminder()).toBe('trip-1');
  });
});
```

- [ ] **Step 3: 実行して失敗を確認する**

```bash
npx vitest run src/app/reminders.test.ts
```

期待: `Failed to resolve import "./reminders"` で失敗する。

- [ ] **Step 4: 実装する**

`src/app/reminders.ts`:

```ts
import type { Trip } from '../domain/types';

const STORAGE_KEY = 'trip-wallet:export-reminder-dismissed';

export function readDismissedReminder(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function dismissReminder(tripId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, tripId);
  } catch {
    // 保存できなくても表示の妨げにはしない
  }
}

/**
 * 旅行の終了日を過ぎたらエクスポートを促す。
 * iOS Safari は使わない期間が続くとストレージを消すことがあるため。
 * 日付は "YYYY-MM-DD" 固定長なので文字列比較で大小がそのまま比べられる。
 */
export function needsExportReminder(
  trip: Trip | null,
  today: string,
  dismissedFor: string | null,
): boolean {
  if (trip === null || trip.endDate === null) return false;
  if (dismissedFor === trip.id) return false;
  return trip.endDate <= today;
}
```

- [ ] **Step 5: 実行して通過を確認する**

```bash
npx vitest run src/app/reminders.test.ts
```

期待: PASS。

- [ ] **Step 6: アイコンの元データを作る**

`public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0f172a"/>
  <rect x="124" y="120" width="240" height="96" rx="28" fill="#7dd3fc"/>
  <rect x="104" y="168" width="304" height="216" rx="40" fill="#38bdf8"/>
  <circle cx="344" cy="276" r="28" fill="#0f172a"/>
</svg>
```

マスカブルアイコンの安全領域(中心から半径 205px)に収まる寸法にしてある。Android のアイコン切り抜きで財布の角が欠けない。

- [ ] **Step 7: PNG 生成スクリプトを作る**

`scripts/generate-icons.mjs`:

```js
// public/icon.svg から PWA 用の PNG を作る。生成物は commit する。
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  await writeFile(new URL(`../public/${name}`, import.meta.url), png);
  console.log(`${name} (${size}px)`);
}
```

`package.json` の `scripts` に追加:

```json
"icons": "node scripts/generate-icons.mjs"
```

- [ ] **Step 8: アイコンを生成する**

```bash
npm run icons
```

期待: `public/icon-192.png` / `icon-512.png` / `apple-touch-icon.png` の 3 つが作られる。

- [ ] **Step 9: `vite.config.ts` に PWA プラグインを足す**

`vite.config.ts`(全文を置き換える):

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/trip-wallet/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // テスト実行時は Service Worker を組み立てない(仮想モジュールは stub が入る)
      disable: process.env.NODE_ENV === 'test',
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Trip Wallet — 旅行支出メモ',
        short_name: 'Trip Wallet',
        description: '外貨の支出をその日のレートで円換算して記録する',
        lang: 'ja',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.frankfurter\.dev\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rates-frankfurter',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/open\.er-api\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rates-er-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 10: 型定義とメタタグを足す**

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
```

`index.html` の `<head>` に追記(`%BASE_URL%` は Vite が `base` に置き換える):

```html
    <meta name="theme-color" content="#0f172a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Trip Wallet" />
    <link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png" />
```

- [ ] **Step 11: Service Worker とストレージ永続化のフックを作る**

`src/app/pwa.ts`:

```ts
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePwaUpdate(): { needRefresh: boolean; updateApp: () => void } {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({});

  return {
    needRefresh,
    updateApp: () => {
      void updateServiceWorker(true);
    },
  };
}

/**
 * ストレージの永続化を要求する。
 * iOS Safari は 7 日間使われないサイトのデータを消すことがあるため、
 * 起動時に一度だけ要求しておく。拒否されても動作は変わらない。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
```

- [ ] **Step 12: 起動時に当日レートを先読みする**

`src/main.tsx` の `createRoot(...).render(...)` の**後**に追記:

```tsx
// 現地で電波が悪くても入力が止まらないよう、起動時に当日レートを取っておく
void import('./rates/resolveRate').then(async ({ prefetchTodayRate }) => {
  const { listTrips } = await import('./data/tripRepo');
  const trips = await listTrips();
  for (const currency of new Set(trips.map((t) => t.currency))) {
    void prefetchTodayRate(currency);
  }
});
```

- [ ] **Step 13: `App.tsx` に更新トーストとエクスポート促しを組み込む**

`src/app/App.tsx`(全文を置き換える):

```tsx
import { useEffect, useState } from 'react';
import { todayLocal } from '../domain/date';
import { HomeScreen } from '../ui/HomeScreen';
import { SettingsScreen } from '../ui/SettingsScreen';
import { SummaryScreen } from '../ui/SummaryScreen';
import { usePwaUpdate, requestPersistentStorage } from './pwa';
import { dismissReminder, needsExportReminder, readDismissedReminder } from './reminders';
import { useActiveTrip } from './useActiveTrip';

type Tab = 'home' | 'summary' | 'settings';

export function App() {
  const { trips, activeTrip, loading, selectTrip } = useActiveTrip();
  const [tab, setTab] = useState<Tab>('home');
  const { needRefresh, updateApp } = usePwaUpdate();
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissedReminder());

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const showExportReminder = needsExportReminder(activeTrip, todayLocal(), dismissed);

  if (loading) {
    return (
      <main className="screen">
        <p className="empty">読み込み中…</p>
      </main>
    );
  }

  return (
    <>
      <main className="screen">
        <header className="app-header">
          <h1>{activeTrip?.name ?? 'Trip Wallet'}</h1>
        </header>

        {showExportReminder && activeTrip !== null && (
          <div className="banner">
            <span>旅行が終わりました。設定からデータを書き出しておきましょう。</span>
            <button type="button" className="btn-primary" onClick={() => setTab('settings')}>
              設定へ
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                dismissReminder(activeTrip.id);
                setDismissed(activeTrip.id);
              }}
            >
              閉じる
            </button>
          </div>
        )}

        {tab === 'home' &&
          (activeTrip !== null ? (
            <HomeScreen trip={activeTrip} />
          ) : (
            <p className="empty">まず「設定」タブで旅行を作成してください。</p>
          ))}

        {tab === 'summary' &&
          (activeTrip !== null ? (
            <SummaryScreen trip={activeTrip} />
          ) : (
            <p className="empty">まず「設定」タブで旅行を作成してください。</p>
          ))}

        {tab === 'settings' && (
          <SettingsScreen trips={trips} activeTrip={activeTrip} onSelectTrip={selectTrip} />
        )}
      </main>

      {needRefresh && (
        <button type="button" className="toast update" onClick={updateApp}>
          新しいバージョンがあります。タップで更新
        </button>
      )}

      <nav className="tabbar">
        <button
          type="button"
          className={tab === 'home' ? 'tab active' : 'tab'}
          onClick={() => setTab('home')}
        >
          🏠 ホーム
        </button>
        <button
          type="button"
          className={tab === 'summary' ? 'tab active' : 'tab'}
          onClick={() => setTab('summary')}
        >
          📊 集計
        </button>
        <button
          type="button"
          className={tab === 'settings' ? 'tab active' : 'tab'}
          onClick={() => setTab('settings')}
        >
          ⚙️ 設定
        </button>
      </nav>
    </>
  );
}
```

- [ ] **Step 14: スタイルを追記する**

`src/styles.css` の末尾に追記:

```css
.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: var(--surface-2);
  border-left: 4px solid var(--accent);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  margin-bottom: 12px;
}

.banner span {
  flex: 1 1 100%;
}

.toast.update {
  background: var(--accent);
  color: #062033;
  font-weight: 600;
}
```

- [ ] **Step 15: デプロイのワークフローを作る**

`.github/workflows/deploy.yml`:

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`npm ci` を使うので `package-lock.json` は commit されている必要がある(`.gitignore` には入っていない)。

- [ ] **Step 16: README を書く**

`README.md`:

````markdown
# Trip Wallet

海外旅行で使った外貨を、その日の為替レートで日本円に換算して記録する PWA。データは端末内(IndexedDB)にだけ保存する。

## できること

- 旅行(Trip)ごとに通貨・期間・予算・人数を設定
- 支出の記録: 金額・個別/共有・カテゴリ・支払い方法・メモ・レシート写真
- レートは Frankfurter(ECB)から自動取得。取れないときは直近キャッシュ、支出ごとの手動上書きも可能
- 記録時のレートを支出に焼き付けるので、あとから合計金額が変わらない
- 合計 / 個別 / 共有(人数割り)/ カテゴリ別 / 日別の集計と、予算の残額表示
- オフラインで入力・閲覧できる
- JSON でのバックアップ書き出しと取り込み

## 開発

```bash
npm install
npm run dev -- --host   # 同一 LAN のスマホから実機確認する
npm run test
npm run build
npm run preview
```

アイコンを変えたら `public/icon.svg` を編集して `npm run icons` を実行し、生成された PNG も commit する。

## 配布

`main` に push すると GitHub Actions が GitHub Pages へデプロイする。リポジトリの Settings → Pages で Source を「GitHub Actions」にしておくこと。

公開先が `https://<user>.github.io/trip-wallet/` 以外になる場合は `vite.config.ts` の `BASE` を変更する。

## 対応通貨

Frankfurter が使う ECB 参照レートの対象通貨のみ: CNY / KRW / USD / EUR / THB / HKD / SGD / GBP / AUD。TWD など ECB が公表していない通貨は自動取得できないため入れていない。

## 手動確認チェックリスト

リリース前に実機で確認する。

- [ ] iPhone / Android のブラウザで開き、ホーム画面に追加してアプリとして起動できる
- [ ] 旅行を作成し、テンキーで金額を入れて保存できる(3 タップで完了する)
- [ ] レート行に「1元 = 23.47円」が出て、タップで手動上書きできる
- [ ] レシート写真を撮って保存し、アプリを再起動しても一覧にサムネイルが出る
- [ ] 機内モードにして支出を保存でき、直近レートを使っている旨の表示が出る
- [ ] キャッシュが空の状態(初回からオフライン)でレート手動入力を求められ、入力すれば保存できる
- [ ] 集計タブで個別/共有/人数割り/カテゴリ別/日別が正しく出る
- [ ] 予算を設定した旅行で残額の帯が減り、超過すると赤くなる
- [ ] 設定からバックアップを書き出し、別のブラウザで取り込むとデータが復元される
- [ ] 旅行の終了日を過ぎた状態で起動するとエクスポート促しバナーが出て、閉じると再表示されない
````

- [ ] **Step 17: すべてのテストを実行する**

```bash
npm run test
```

期待: 全ファイルの全テストが PASS。

- [ ] **Step 18: ビルドして PWA の生成物を確認する**

```bash
npm run build
```

期待: 型エラーなし。`dist/` に `sw.js`、`manifest.webmanifest`、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png` が出力される。

- [ ] **Step 19: ローカルでプレビューして動作を確認する**

```bash
npm run preview
```

ブラウザで開き、DevTools の Application タブで manifest と Service Worker が登録されていることを確認する。

- [ ] **Step 20: コミット**

```bash
git add -A && git commit -m "feat: PWA 化とストレージ保全、GitHub Pages への配布を追加"
```

---

## 完了条件

- `npm run test` が全件 PASS する
- `npm run build` が型エラーなしで通り、`dist/` に Service Worker と manifest が出る
- README の手動確認チェックリストを実機で一通り確認できる状態になっている

