# アクセス計測(GoatCounter)導入 実装プラン

**Goal:** 起動回数と寄付リンクのタップ数の 2 つだけを GoatCounter へ送るクッキーレスな計測を入れ、収益化 Phase 2 の判断材料を作る。

**Architecture:** 新規モジュール `src/app/analytics.ts` に閉じる。GoatCounter の公式スクリプトは読み込まず、`/count` エンドポイントの URL を自前で組み立てて `fetch` する。サイトコードは `DONATION_URL` と同じ形の定数 1 つに置き、空文字のあいだは一切送信しない。接続点は `src/main.tsx` の 1 行と `src/ui/SettingsScreen.tsx` の `onClick` 1 つだけ。

**Tech Stack:** TypeScript 7.0 / React 19.2 / Vite 8.2 / Vitest 4.1 + jsdom 29。新規依存はゼロ。

**Spec:** `docs/dev/specs/2026-08-20-analytics-design.md`

## Global Constraints

- **`ANALYTICS_CODE` は空文字のままコミットする。** GoatCounter のアカウント作成とサイトコードの取得はユーザー自身の作業で、このプランの範囲外。空文字なら 1 バイトも送信しないので、コードだけ先にマージできる。
- **`ANALYTICS_CODE` の型注釈 `: string` を消さない。** 外すと文字列リテラル型 `''` に潰れ、`code === ''` の比較が「常に true」として型エラーになる。`DONATION_URL` と同じ理由。
- **`vite.config.ts` は 1 行も変更しない。** 計測 URL を `runtimeCaching` に追加しないので、Service Worker は素通りする。
- **送る HTTP リクエストは 2 種類だけ。** 起動時の `?p=/app&t=launch` と寄付タップの `?p=donate-click&e=1`。GoatCounter が受け付ける `r`(リファラ)・`s`(画面サイズ)・`q`(キャンペーン)は渡さない。
- **アプリの UI には計測の表示を出さない。** `src/i18n/*.ts` に文言を足さない。
- **README 冒頭の「データは端末内(IndexedDB)にだけ保存する」は書き換えない。** これは保存先の約束で、計測を入れても真のまま。
- **新規依存を増やさない。** `package.json` の `dependencies` / `devDependencies` は version 以外を変えない。
- **ブランチは `feature/analytics`。** `main` に直接コミットしない。`main` へのマージはこのプランの範囲外(実装完了後にユーザーの承認を取る)。
- **コミットメッセージは日本語の Conventional Commits。** 既存の履歴(`feat: 寄付リンクに Ko-fi の URL を設定する`)に合わせる。
- **各タスクの最後に `npm run test` と `npm run build` を通す。** 直前の既知の結果は `Tests 324 passed (324)` / `✓ built in 528ms`。

---

## File Structure

| ファイル | 役割 | タスク |
| --- | --- | --- |
| `src/app/analytics.ts` | 新規。サイトコードの定数と、計測を送る関数 2 つ。URL の組み立てと失敗の握りつぶしはここに閉じる | Task 1 |
| `src/app/analytics.test.ts` | 新規。`fetchImpl` を注入して URL の形と無送信条件を固定する | Task 1 |
| `src/main.tsx` | 変更。末尾に `countLaunch();` を 1 行 | Task 2 |
| `src/ui/SettingsScreen.tsx` | 変更。サポートリンクの `<a>` に `onClick` を 1 つ | Task 2 |
| `src/ui/SettingsScreen.test.tsx` | 変更。クリックで計測が呼ばれることを 1 本追加 | Task 2 |
| `README.md` | 変更。計測の節と手動確認 2 項目を追加 | Task 3 |
| `package.json` | 変更。version を 1.0.9 へ | Task 3 |

---

### Task 1: 計測モジュール

**Files:**
- Create: `src/app/analytics.ts`
- Test: `src/app/analytics.test.ts`

**Interfaces:**
- Consumes: なし(このモジュールは他のどのモジュールにも依存しない)
- Produces:
  - `export const ANALYTICS_CODE: string`
  - `export function countLaunch(fetchImpl?: typeof fetch, code?: string): void`
  - `export function countDonationClick(fetchImpl?: typeof fetch, code?: string): void`

**スペックとの差分(意図的):** スペックの公開シグネチャは引数が `fetchImpl` の 1 つだけだった。しかしそれでは「サイトコードが空なら送信しない」をテストで固定できない — `ANALYTICS_CODE` は空文字の定数なので、注入口がないと**全テストが無送信になり、URL の検証が一切効かなくなる**。第 2 引数 `code` を既定引数で足す。これは `shouldShowDonation(url: string = DONATION_URL)` と同じ形で、スペックが言う「`DONATION_URL` と同じ形にする」にむしろ忠実である。

- [ ] **Step 1: 失敗するテストを書く**

`src/app/analytics.test.ts` を新規作成する。

```ts
import { describe, it, expect, vi } from 'vitest';
import { ANALYTICS_CODE, countLaunch, countDonationClick } from './analytics';

// 実際の ANALYTICS_CODE(空文字)と紛れないよう、テストでは別のコードを注入する
const CODE = 'testcode';

// frankfurter.test.ts と同じ流儀で、Response の実体は作らず必要な形だけ返す
function fetchSpy() {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200 }) as Response);
}

// 送信オプションは 2 種類とも同じ。テストの期待値もここから使う。
// 型注釈は必須。無いと mode が string に推論され、toHaveBeenCalledWith が
// fetch の引数型と突き合わせるときに RequestMode へ代入できず型エラーになる。
const INIT: RequestInit = { mode: 'no-cors', cache: 'no-store', keepalive: true };

describe('計測ビーコン', () => {
  it('起動は p=/app&t=launch を送る', () => {
    const f = fetchSpy();
    countLaunch(f as unknown as typeof fetch, CODE);

    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith('https://testcode.goatcounter.com/count?p=%2Fapp&t=launch', INIT);
  });

  it('寄付タップは p=donate-click&e=1 を送る', () => {
    const f = fetchSpy();
    countDonationClick(f as unknown as typeof fetch, CODE);

    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(
      'https://testcode.goatcounter.com/count?p=donate-click&e=1',
      INIT,
    );
  });

  // 送らないと決めたものが後から紛れ込まないよう、URL の形で見張る
  it('リファラ(r)と画面サイズ(s)は送らない', () => {
    const f = fetchSpy();
    countLaunch(f as unknown as typeof fetch, CODE);
    countDonationClick(f as unknown as typeof fetch, CODE);

    expect(f).toHaveBeenCalledTimes(2);
    for (const [url] of f.mock.calls) {
      expect(url).not.toMatch(/[?&]r=/);
      expect(url).not.toMatch(/[?&]s=/);
    }
  });

  it('サイトコードが空のあいだは一切送信しない', () => {
    const f = fetchSpy();
    countLaunch(f as unknown as typeof fetch, '');
    countDonationClick(f as unknown as typeof fetch, '');

    expect(f).not.toHaveBeenCalled();
  });

  it('送信が失敗しても例外が外に出ない', () => {
    const f = vi.fn(async () => {
      throw new Error('オフライン');
    });

    expect(() => countLaunch(f as unknown as typeof fetch, CODE)).not.toThrow();
    expect(() => countDonationClick(f as unknown as typeof fetch, CODE)).not.toThrow();
  });

  it('既定では ANALYTICS_CODE を見る', () => {
    const f = fetchSpy();
    countLaunch(f as unknown as typeof fetch);

    expect(f.mock.calls.length).toBe(ANALYTICS_CODE === '' ? 0 : 1);
  });

  // コード欄に URL を丸ごと貼ると https://https://... の壊れた URL になる。形を見張る。
  it('ANALYTICS_CODE はサブドメインとして使える形である', () => {
    if (ANALYTICS_CODE !== '') expect(ANALYTICS_CODE).toMatch(/^[a-z0-9-]+$/);
  });
});
```

補足 2 点:
- **`p=%2Fapp` のエンコードは正しい。** `URLSearchParams` が `/` を `%2F` にする。GoatCounter は受け取ったあとデコードするので、ダッシュボードには `/app` と出る。
- 最後の 2 本は `src/app/donation.test.ts` の「既定では `DONATION_URL` を見る」「`DONATION_URL` は絶対 URL である」と対になっている。スペックの列挙は 5 本だが、既存モジュールと同じ守り方を揃えるために 2 本足している。

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx vitest run src/app/analytics.test.ts
```

期待: `Failed to load` または `Cannot find module './analytics'` で失敗する。

- [ ] **Step 3: 最小の実装を書く**

`src/app/analytics.ts` を新規作成する。

```ts
/**
 * GoatCounter のサイトコード。差し替えるのはこの 1 行だけ。
 * 空文字のあいだは一切送信しない。型は string に固定しておく(リテラル型に潰れると空文字との比較が壊れる)。
 */
export const ANALYTICS_CODE: string = '';

// no-cors なので応答は読めないが、送るだけなので問題ない。
// cache: 'no-store' でキャッシュされないため、キャッシュバスターの rnd パラメータは要らない。
// keepalive は、寄付リンクが別タブを開くときにリクエストが打ち切られるのを防ぐ。
const INIT: RequestInit = { mode: 'no-cors', cache: 'no-store', keepalive: true };

/**
 * GoatCounter に 1 発だけ送る。
 * 計測でアプリを止めないので、オフラインでも広告ブロッカーの下でも失敗は握りつぶす。
 */
function send(params: Record<string, string>, fetchImpl: typeof fetch, code: string): void {
  if (code === '') return;
  const query = new URLSearchParams(params).toString();
  void fetchImpl(`https://${code}.goatcounter.com/count?${query}`, INIT).catch(() => {});
}

/** 起動を 1 回数える。 */
export function countLaunch(fetchImpl: typeof fetch = fetch, code: string = ANALYTICS_CODE): void {
  send({ p: '/app', t: 'launch' }, fetchImpl, code);
}

/** 寄付リンクのタップを数える。 */
export function countDonationClick(
  fetchImpl: typeof fetch = fetch,
  code: string = ANALYTICS_CODE,
): void {
  send({ p: 'donate-click', e: '1' }, fetchImpl, code);
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

```bash
npx vitest run src/app/analytics.test.ts
```

期待: 7 本すべて PASS。

- [ ] **Step 5: 全体のテストと型検査を通す**

```bash
npm run test
```

期待: `Tests 331 passed (331)`(既存 324 本 + 新規 7 本)。

```bash
npm run build
```

期待: 型エラーなしでビルドが成功する。

- [ ] **Step 6: コミット**

```bash
git add src/app/analytics.ts src/app/analytics.test.ts
git commit -m "feat: GoatCounter へ起動と寄付タップを送る計測モジュールを追加する"
```

---

### Task 2: 接続点

**Files:**
- Modify: `src/main.tsx`(import 行と末尾)
- Modify: `src/ui/SettingsScreen.tsx`(import 行と 178-193 行のサポートセクション)
- Test: `src/ui/SettingsScreen.test.tsx`(モック定義・`beforeEach`・「サポートセクション」の describe)

**Interfaces:**
- Consumes: Task 1 の `countLaunch(fetchImpl?: typeof fetch, code?: string): void` と `countDonationClick(fetchImpl?: typeof fetch, code?: string): void`。どちらも引数なしで呼び、既定の `fetch` と `ANALYTICS_CODE` を使う。
- Produces: なし(これが最終の接続点)

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/SettingsScreen.test.tsx` を 3 箇所直す。

(1) import に 1 行足す(`import { shouldShowDonation } from '../app/donation';` の**前**に置く。既存の import はパスのアルファベット順)。

```tsx
import { countDonationClick } from '../app/analytics';
```

(2) `vi.mock('../app/donation', ...)` のすぐ下にモックを足す。

```tsx
vi.mock('../app/analytics', () => ({
  countDonationClick: vi.fn(),
}));
```

(3) `beforeEach` の最終行 `vi.mocked(shouldShowDonation).mockReturnValue(false);` の下に 1 行足す。

```tsx
  vi.mocked(countDonationClick).mockReset();
```

(4) `describe('サポートセクション', ...)` の最後(`英語でも文言が切り替わる` の次)にテストを 1 本足す。

```tsx
  it('寄付リンクをタップすると計測する', async () => {
    vi.mocked(shouldShowDonation).mockReturnValue(true);
    const user = userEvent.setup();
    renderWithLang(<SettingsScreen trips={[]} activeTrip={null} onSelectTrip={() => {}} />);

    // jsdom は別タブへの遷移を実装していないので、既定動作だけ止めてからクリックする。
    // preventDefault は伝播を止めないので、React の onClick は通常どおり呼ばれる。
    const link = screen.getByRole('link', { name: 'Ko-fi で支援する' });
    link.addEventListener('click', (e) => e.preventDefault());
    await user.click(link);

    expect(vi.mocked(countDonationClick)).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx vitest run src/ui/SettingsScreen.test.tsx
```

期待: 「寄付リンクをタップすると計測する」だけが `expected "spy" to be called 1 times, but got 0 times` で失敗し、他の 12 本は PASS のまま。

- [ ] **Step 3: 寄付リンクに `onClick` を足す**

`src/ui/SettingsScreen.tsx` の import に 1 行足す(3 行目 `import { DONATION_URL, shouldShowDonation } from '../app/donation';` の**前**)。

```tsx
import { countDonationClick } from '../app/analytics';
```

サポートセクションの `<a>` に `onClick` を 1 つ足す。

```tsx
      {shouldShowDonation() && (
        <section>
          <h3>{t.settings.support}</h3>
          <p className="hint">{t.settings.supportHint}</p>
          <div className="form-actions">
            <a
              className="btn-ghost link-btn"
              href={DONATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => countDonationClick()}
            >
              {t.settings.supportLink}
            </a>
          </div>
        </section>
      )}
```

**アロー関数で包むこと。** `onClick={countDonationClick}` と書くと React が `MouseEvent` を第 1 引数に渡すため、それが `fetchImpl` として使われて壊れる。

- [ ] **Step 4: テストを実行して通ることを確認する**

```bash
npx vitest run src/ui/SettingsScreen.test.tsx
```

期待: 13 本すべて PASS。

- [ ] **Step 5: 起動時の計測を足す**

`src/main.tsx` の import に 1 行足す(`import { App } from './app/App';` の**前**)。

```tsx
import { countLaunch } from './app/analytics';
```

ファイル末尾(`void listTrips()` のチェーンの後)に足す。

```tsx
// 起動回数を GoatCounter に 1 回だけ送る。サイトコードが空のあいだは何も起きない
// React ツリーの外なので StrictMode の二重実行に巻き込まれない
// countLaunch は Promise を返さない(内部で握りつぶす)ので void 演算子は付けない
countLaunch();
```

- [ ] **Step 6: 全体のテストと型検査を通す**

```bash
npm run test
```

期待: `Tests 332 passed (332)`(Task 1 の 331 本 + SettingsScreen の 1 本)。

```bash
npm run build
```

期待: 型エラーなしでビルドが成功する。

- [ ] **Step 7: コミット**

```bash
git add src/main.tsx src/ui/SettingsScreen.tsx src/ui/SettingsScreen.test.tsx
git commit -m "feat: 起動と寄付リンクのタップを計測につなぐ"
```

---

### Task 3: ドキュメントとバージョン

**Files:**
- Modify: `README.md`(「## 配布」の後に節を追加、「## 手動確認チェックリスト」に 2 項目追加)
- Modify: `package.json:4`

**Interfaces:**
- Consumes: Task 1 の `ANALYTICS_CODE`(README から名前で参照する)
- Produces: なし

- [ ] **Step 1: README に計測の節を足す**

「## 配布」の節の最後の行(`公開先が https://<user>.github.io/trip-wallet/ 以外になる場合は vite.config.ts の BASE を変更する。`)と「## 対応言語」のあいだに、次を挿入する。

```markdown
## アクセス計測

利用状況を知るために GoatCounter へ次の 2 種類だけ送る。クッキーも localStorage も使わない。

| いつ | 送る内容 |
| --- | --- |
| 起動時に 1 回 | パス `/app` とタイトル `launch` |
| 設定タブの支援リンクをタップ | イベント `donate-click` |

記録した支出は 1 件も送らない。旅行名・金額・通貨・カテゴリ・メモ・レシート写真には触れず、リファラ(`r`)と画面サイズ(`s`)も渡さない。GoatCounter は IP アドレスを保存しないが、リクエストが届く以上、国・ブラウザ・OS は集約値として向こう側に残る。

送信先は `src/app/analytics.ts` の `ANALYTICS_CODE` で決まる。空文字のあいだは一切送信しない。GoatCounter の公式スクリプトは読み込まず、URL を自前で組み立てて `fetch` する。失敗はすべて握りつぶすので、オフラインでも広告ブロッカーの下でもアプリの動作は変わらない(その分は計測されない)。

外部へ出る通信はこれと為替レートの取得(Frankfurter へ通貨ペアと日付を送る)の 2 つだけで、支出データはどちらにも含まれない。
```

**README 冒頭の「データは端末内(IndexedDB)にだけ保存する」は変更しない。**

- [ ] **Step 2: 手動確認チェックリストに 2 項目足す**

README 末尾の最終行(`- [ ] 設定タブにサポートセクションが出て、タップで Ko-fi(https://ko-fi.com/unikpip)が別タブで開く`)の下に足す。

```markdown
- [ ] `ANALYTICS_CODE` を設定して起動すると、GoatCounter のダッシュボードに `/app` が 1 件増える
- [ ] 支援リンクをタップすると `donate-click` が 1 件増える
```

この 2 項目は GoatCounter のアカウント作成後にしか確認できない。サイトコードが空のあいだは未チェックのままでよい。

- [ ] **Step 3: version を上げる**

`package.json` の 4 行目を書き換える。

```json
  "version": "1.0.9",
```

`dependencies` と `devDependencies` は 1 行も変えない。

- [ ] **Step 4: テストと型検査を通す**

```bash
npm run test
```

期待: `Tests 332 passed (332)`(README と package.json の変更ではテスト数は変わらない)。

```bash
npm run build
```

期待: 型エラーなしでビルドが成功する。

- [ ] **Step 5: コミット**

```bash
git add README.md package.json
git commit -m "docs: アクセス計測の内容を README に書き、version を 1.0.9 に上げる"
```

---

## プラン外の作業(実装完了後)

このプランのタスクには含めない。実装がすべて終わってから順に行う。

1. **`main` へのマージ承認を取る。** version を 1.0.9 に上げるため、グローバルルールに従って AskUserQuestion で確認してからマージする。
2. **GoatCounter のアカウント作成とサイトコードの取得。** ユーザー自身の作業。取得後、`src/app/analytics.ts` の `ANALYTICS_CODE` の 1 行を差し替えて再デプロイする(Phase 1 で `DONATION_URL` を差し替えたのと同じ手順)。
3. **メモリの更新。** `trip-wallet-deferred-items.md` の「Phase 2(AdSense を入れるか)は未着手」を、AdSense 却下と計測導入の結果に書き換える。
