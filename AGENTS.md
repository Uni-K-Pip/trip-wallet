# trip-wallet(Trip Wallet)

海外旅行で使った外貨を、その日の為替レートで自分の通貨に換算して記録する PWA。データは端末内(IndexedDB)にだけ保存する。

## 関連
- remote: `Uni-K-Pip/trip-wallet`(public)。main への push で GitHub Pages に公開される(.github/workflows/deploy.yml)。

## 進め方
- ブランチ: main が公開元。作業は別ブランチで行う。
- 確認: `npm run test`、`npm run lint`
- 読む順: README.md、docs/design/README.md

## 引き継ぎ
- 現在地は Git の履歴と README.md で確かめる。
- 1 つの作業ツリーに書き込むセッションは 1 つ。並行するときは worktree を分け、ブランチ名に担当を入れる(`claude/…`、`codex/…`)。
