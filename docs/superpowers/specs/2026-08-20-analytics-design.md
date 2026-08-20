# 収益化 Phase 2 の決着とアクセス計測の設計

作成: 2026-08-20

前提スペック: `docs/superpowers/specs/2026-08-12-v1.0.8-monetization-design.md`(Phase 1 = Ko-fi の寄付リンク。2026-08-19 に v1.0.8 としてリリース済み)

このスペックは、上記スペックが「今決めないこと(Phase 2 着手時に決める)」として残した論点に決着をつけ、その代わりに何を作るかを定める。

## 決定 1: AdSense は入れない

前提スペックは Phase 2 を「寄付の反応を見て、Web 広告(AdSense)を入れるか判断する」としていた。2026-08-20 に最新情報を再確認した結果、**入れない**と決めた。理由は 4 つある。

- **審査に通る見込みが薄い。** ツールを 46 本並べ、各ツールの解説文とカテゴリごとに 800〜1,500 字のガイド、運営者情報の About ページまで整えた個人開発者が、2 回とも「有用性の低いコンテンツ」で落ちた実例がある。AdSense が評価するのは編集コンテンツであって、機能するコードではない。Trip Wallet はツール 1 本・記事ゼロ・テキストは UI ラベルのみで、この事例より条件が悪い。
- **ドメインが承認を取れない。** AdSense はサブドメインを個別に審査せず、親ドメインの承認状態を使う。`uni-k-pip.github.io` の親は GitHub の `github.io` で、こちらが承認を取れる対象ではない。`mysite.wordpress.com` と同じ構造で詰む。
- **`ads.txt` を置けない。** 有効なのは `https://uni-k-pip.github.io/ads.txt` だけで、プロジェクトページ配下の `/trip-wallet/` には置けない。`Uni-K-Pip/uni-k-pip.github.io` リポジトリの新規作成が要る。これはストア配布から撤退したときに `assetlinks.json` で行き詰まったのと同型の問題である。
- **割に合わない。** 収益は月数百円オーダーで、発見経路が Web 検索と口コミしかない現状では実質ゼロに近い。対して UX の悪化は確実に起きる。

補足として、GitHub の規約は広告そのものを禁じていない(制限は「アカウントで投稿するコンテンツの主目的が広告や販促であってはならない」「GitHub Pages を無料ホスティングとしてオンラインビジネス・EC・SaaS の運用に使ってはならない」)。ここは障害ではなかった。

もう 1 点、設定画面のサポート欄の文言が「個人が趣味で作っているアプリです。**広告も有料機能もありません。**」である。AdSense を入れるとこの一文が嘘になる。却下の判断はこの文言とも整合する。

## 決定 2: 判断材料を作るためにアクセス計測を入れる

前提スペックは Phase 2 の判断材料を「アクセス数と寄付の有無」と定めていた。しかし着手時点で、**アクセス数を測る手段が存在しない**ことが分かった。アクセス解析は未導入で、GitHub Pages はアクセスログを出さない。つまり「材料を見て判断する」フェーズなのに、材料を作る工程が抜けていた。

そこで Phase 2 の実作業を「広告を入れるかの判断」から「判断材料を作ること」に置き換える。数か月データを貯めてから、本来の Phase 2 相当の判断を改めて行う。

寄付の有無は Ko-fi のダッシュボードで分かるので、計測で足すのは残りだけでよい。

## 測るもの

2 つだけ測る。

- **起動回数** — 人が来ているかどうか
- **寄付リンクのタップ数** — サポートセクションまで届いているかどうか

この 2 つと Ko-fi 側の入金実績を突き合わせると、寄付がゼロだったときの原因を 3 つに切り分けられる。「そもそも人が来ない」「来るが導線に気づかれない」「気づいて押すが寄付には至らない」。次の一手はそれぞれ別なので、この切り分けに意味がある。

## 手段: GoatCounter に自前の最小ビーコンで送る

GoatCounter を選ぶ。無料(公式の条件は「reasonable public usage」で、個人サイトも中小企業も可。第三者記事が言う「非商用限定」より緩い)、IP アドレスを保存せず集約データだけを残し、クッキーも localStorage も使わない。GDPR の同意通知は「おそらく不要」というのが GoatCounter 自身の見解である。

Cloudflare Web Analytics は**カスタムイベントに対応していない**ため脱落した。寄付タップが測れない。

公式スクリプト `count.js` は**読み込まない**。GoatCounter の `/count` エンドポイントは GET に対して 1×1 GIF を返し、JavaScript 統合なしで直接叩ける。自前で URL を組み立てて `fetch` するほうが、送る内容を完全にこちらで決められ、テストも書けて、外部スクリプトの分だけ起動が遅くなることもない。このアプリの原則は「送らない」であって「無料の計測を使う」ではないので、送る内容がコードとして読める形を選ぶ。

## 送るもの / 送らないもの

アプリの一生涯で送る HTTP リクエストはこの 2 種類だけである。

| いつ | URL |
| --- | --- |
| 起動時に 1 回 | `https://<code>.goatcounter.com/count?p=/app&t=launch` |
| 寄付リンクのタップ | `https://<code>.goatcounter.com/count?p=donate-click&e=1` |

GoatCounter が受け付けるが**意図的に渡さない**パラメータ:

- `r`(リファラ)— どこから来たかは測らない
- `s`(画面サイズ)— 端末の特定に繋がりうる
- `q`(キャンペーンパラメータ)

旅行名・金額・通貨・カテゴリ・メモ・レシート写真には一切触れない。タブの切り替えや画面遷移も送らない。

**避けられないもの。** 上記を渡さなくても、HTTP リクエストが届く以上、GoatCounter 側には国・ブラウザ・OS が集約値として記録される(IP そのものは保存されない)。これは実装方式によらず避けられないので、README に正直に書く。

送信は `fetch(url, { mode: 'no-cors', cache: 'no-store', keepalive: true })` を使う。`no-cors` なので CORS 設定が要らない(レスポンスは読めないが、送るだけなので問題ない)。`cache: 'no-store'` によってキャッシュバスターの `rnd` パラメータが不要になる。`keepalive` は、寄付リンクが別タブを開く際にリクエストが中断されるのを防ぐ。

## モジュール設計

新規モジュール `src/app/analytics.ts` に閉じる。公開するのは定数 1 つと関数 2 つだけ。以下は公開シグネチャで、本体は実装時に書く。

```ts
/** GoatCounter のサイトコード。差し替えるのはこの 1 行だけ。空のあいだは一切送信しない。 */
export const ANALYTICS_CODE: string = '';

export function countLaunch(fetchImpl?: typeof fetch): void;
export function countDonationClick(fetchImpl?: typeof fetch): void;
```

`DONATION_URL` と同じ形にする。空文字なら完全に無送信なので、**GoatCounter のアカウントを作る前にコードをマージできる**。型注釈 `: string` は `DONATION_URL` と同じ理由で必要(外すとリテラル型に潰れて空文字との比較が型エラーになる)。

`fetchImpl` の既定引数による注入は、`src/rates/frankfurter.ts` の `fetchFrankfurterRate` が既に使っているパターンに合わせたもの。

## 接続点

- **起動**: `src/main.tsx` の末尾に `countLaunch();` を 1 行。既存の `prefetchTodayRate` の先読みと同じ位置(React ツリーの外・ベストエフォート)なので、StrictMode の二重実行に巻き込まれない。戻り値が `void` なので、隣の `void listTrips()` と違って `void` 演算子は付けない。
- **寄付タップ**: `src/ui/SettingsScreen.tsx` のサポートリンクの `<a>` に `onClick` を 1 つ。`target="_blank"` なので画面遷移はしない。

## Service Worker とエラー処理

計測 URL を `vite.config.ts` の `runtimeCaching` に**追加しない**。Workbox のパターンは Frankfurter と er-api だけなので、計測リクエストは Service Worker を素通りする。`globPatterns` にも `navigateFallback` にも影響しない。**`vite.config.ts` は 1 行も変更しない。**

失敗はすべて握りつぶす。オフライン起動・広告ブロッカーによる遮断・GoatCounter 側の障害のいずれでも、アプリの動作は変わらない。PWA の standalone 起動では、Service Worker のキャッシュから返った HTML の上でも JS は動くので、オンラインであれば計測される。オフライン中の起動は計測されない。これは仕様として受け入れる。

## テスト

`src/app/analytics.test.ts` を新規に追加し、`fetchImpl` を注入して次を検証する。

- 起動の URL が `?p=/app&t=launch` の形に組み立てられる
- 寄付タップの URL が `?p=donate-click&e=1` になる
- **`r=` と `s=` が URL に含まれない** — 送らないと決めたものが後から漏れないよう、テストで固定する
- `ANALYTICS_CODE` が空なら `fetchImpl` が呼ばれない
- `fetchImpl` が reject しても例外が外に出ない

`src/ui/SettingsScreen.test.tsx` に「寄付リンクのクリックで計測が呼ばれる」を 1 本追加する。

## ドキュメント

README に計測の節を追加する。何を送り、何を送らないか、そして GoatCounter 側に国・ブラウザ・OS が残ることを書く。

README の冒頭にある「データは端末内(IndexedDB)にだけ保存する」は**書き換えない**。これは保存先の約束であって送信の話ではなく、計測を入れても真のままである(記録した支出は 1 件も外に出ない)。既に為替レートの取得で Frankfurter へ通貨ペアと日付を送っているのと同じ扱いになる。

**アプリの UI には出さない。** 送るのは起動回数と寄付タップの 2 種類だけで個人を特定せず、GoatCounter の見解では GDPR の同意通知も不要であるため。設定画面に新しいセクションを足すコストと 4 言語分の文言追加に見合わない。

## バージョン

`package.json` の version を **1.0.9** に上げる。サイトコードが空のうちは実質何も起きないが、外部への送信が 1 つ増えるのはユーザーにとって意味のある変化なので、リリースとして区切る。

## 運用

GoatCounter のアカウント作成とサイトコードの取得は**ユーザー自身の作業**になる。取得後、`ANALYTICS_CODE` の 1 行を差し替えて再デプロイする。Phase 1 で `DONATION_URL` を差し替えたのと同じ手順である。

## スコープ外

- タブ別の利用状況・滞在時間・ユーザー識別・A/B テスト
- 計測の ON/OFF トグル(母数が小さいので、切れるようにすると判断材料としての価値が下がる)
- ダッシュボードの読み方と、本来の Phase 2 相当の再判断。数か月データを貯めてから別途行う
- Web 決済による有料化(日本の特商法による住所表示義務があるため、前提スペックの判断のまま保留)

## リスク

- **広告ブロッカーによる遮断。** GoatCounter は主要なブロックリストに載っている。計測値は実際の利用より少なめに出る。絶対値ではなく傾向として読む。
- **GoatCounter は個人が 1 人で運営している。** 停止した場合は計測が止まるが、アプリの動作には影響しない(失敗を握りつぶすため)。セルフホスト可能な OSS(EUPL-1.2)なので、必要なら移行できる。
- **母数が小さすぎて判断できない可能性。** 数か月貯めても起動が数十回であれば、それ自体が「発見されていない」という答えになる。その場合の次の一手は収益化ではなく認知である。

## 参照

- GoatCounter トラッキングピクセル: https://www.goatcounter.com/help/pixel
- GoatCounter イベント: https://www.goatcounter.com/help/events
- GoatCounter と GDPR: https://www.goatcounter.com/help/gdpr
- Cloudflare Web Analytics FAQ: https://developers.cloudflare.com/web-analytics/faq/
- AdSense 審査の実例(ツール 46 本で 2 回落選): https://zenn.dev/sktt_panda/articles/panda-tools-adsense-rejection
- AdSense の親ドメイン判定: https://github.com/google/site-kit-wp/issues/8935
- ads.txt の設置場所: https://support.google.com/adsense/answer/9785052
