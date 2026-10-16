# noca

**ふたりの「やること・予定・メモ」を、ひとつの場所に。**

noca は、2人で使うことを目指す **iPhoneファーストの日本語PWA** です。メイン画面は **TODO / カレンダー / メモ** の3つ。スマホの片手操作・落ち着いたデザイン・必要十分な情報密度を重視しています。

**プレビュー:** https://noca-delta.vercel.app  
**ソース:** https://github.com/ShunsukeOta/noca  
**開発状況:** TODO・カレンダーのFirestore共有同期、Web Push通知のソースを実装しています。最新Rules/indexesはFirebase `noca-df141`へ反映済みですが、認証・二端末の受け入れ確認は未完了です。メモタブは残し、「メモ機能は開発中です」と案内するプレースホルダーです。

> [!IMPORTANT]
> **共有運用と通知の実環境確認は未完了です。** Firebase未設定時は同一ブラウザの `localStorage` を使う1人用プレビューです。共有同期ではTODO・カテゴリ・予定をFirestoreへ保存し、既存データを追加移行します。Firestore Rules/indexesは2026-10-16にFirebase `noca-df141`へデプロイ済みですが、Phase 2の2アカウント確認、2端末同期・オフライン復帰・競合の受け入れ確認は未完了です。プッシュ通知のクライアントとFunctionsソースはありますが、FirebaseプロジェクトがSparkプランのためSecret Manager/Functionsをまだデプロイできていません。Blazeへの変更、VAPID鍵、Vercel公開鍵設定、iPhone実機確認が必要です。メモ機能は開発中です。設定からJSONバックアップを書き出して復元できます。Firebaseの設定は[セットアップ手順](docs/FIREBASE_SETUP.md)を参照してください。

## Codex / AIエージェントへの引き継ぎ

**まず [AGENTS.md](AGENTS.md) を読んでください。** 続いて [最新引き継ぎメモ](docs/CODEX_HANDOFF.md)、[コード構成と保存仕様](docs/ARCHITECTURE.md)、[デザインシステム](docs/DESIGN_SYSTEM.md) を確認してください。

- `AGENTS.md`：変更時の必須ルール、作業手順、テストと禁則
- `docs/CODEX_HANDOFF.md`：**現在地・検証済み範囲・次の実装・既知の注意点**
- `docs/ARCHITECTURE.md`：画面とProviderの関係、各実装ファイル、データ契約、localStorage、PWA/CI
- `docs/DESIGN_SYSTEM.md`：**ユーザーが決めた見た目とUI設計**。独断で変更しない

これらは**現行実装から確認して更新した資料**です。`docs/PHASE1*_REPORT.md` は過去のチェックポイントの記録なので、最新仕様と混同しないでください。

## 現在できること

| 画面・機能 | 現状 | 主な操作・特徴 |
| --- | --- | --- |
| **TODO** | **動作**・端末内に保存 | 作成・編集・完了/解除・削除/Undo。完了一覧には未完了へ戻すアイコンと完全削除アイコンがあります。共有同期中の完全削除はTODO本文をFirestoreから削除し、古い端末からの復活を防ぐID・版数だけを残します。カテゴリは設定から追加・名前変更・色変更・並び替え・削除ができ、削除時はTODOを別カテゴリへ移動。 |
| **カレンダー** | **動作** | 月移動・日付選択、予定の作成/編集/削除/Undo、終日・開始/終了、期限付きTODOの参照。初期状態は担当表示のない1人用タイムライン。共有同期を開始するとTODOと同様にworkspaceへ保存します（実環境検証前） |
| **メモ** | **開発中** | メモタブを開くと「メモ機能は開発中です」と表示。入力や保存の操作はありません。 |
| **設定** | テーマ・TODOカテゴリ・バックアップ・共有同期・通知 | Googleログイン、共有スペース、同期開始、バックアップに加え、この端末ごとに時刻付き予定30分前・TODO期限当日9:00・相手のTODO/予定追加を切り替え可能。通知サーバー未設定時は操作できず、同期を開始したワークスペースが必要 |
| **PWA** | 基本構成あり | manifest / service workerの自動更新とプッシュ通知受信を実装。iPhoneはiOS 16.4以降のホーム画面追加アプリから登録します。通知を届けるFirebase Functionsは追加済みですが未デプロイです。共有同期のオフラインキューも実機検証前です |

### UIで守るべき重要な決定

- **上部：** スクロールしても残る固定ヘッダー。nocaロゴの隣に**今日の日付**、右に現在のメンバーと設定アイコン。初期状態は「自分」1人だけを表示し、設定画面では設定アイコンが「×」になって開く前の画面へ戻れます。
- **下部：** 左の白いフローティングボックスに **TODO / カレンダー / メモ**。TODO/カレンダーでは**16px離れた右側に独立した濃色の＋ボタン**。メモは開発中表示のため＋を隠します。設定画面ではグローバルメニュー全体を非表示にします。
- **TODO：** 最初に「すべて」と設定済みカテゴリの2段ボタン。初期カテゴリはおでかけ・暮らし・ふたり・その他で、設定から追加・編集できます。カテゴリタグと同じ色。大きな「残りのタスク」ボックスと「これからすること ○件」の見出しはありません。
- **カレンダー：** 初期状態は担当見出しを置かない1列タイムラインです。2人のメンバーがいる場合はA/Bの2列になり、共有予定は終日・時刻付きとも全幅で表示します。1時間=54px、単独表示の短い予定は最小36px。同一担当の時間重複は最長の予定を表示し、「他N件」チップから正確な時刻付き一覧を開きます。
- **入力：** 角丸のボトムシート。iPhoneでキーボードが出たら `visualViewport` に応じて移動し、保存ボタンを見失わない設計。開いた直後の自動フォーカスはしません。
- **動き：** Motionによる自然なアニメーション。`prefers-reduced-motion` を尊重。ライト・ダーク両テーマ対応。
- **共通UI：** 入力・ラベル・ボタン・チェック・スイッチ・担当/カテゴリ選択・破棄確認・Undo通知をローカルの共通部品で管理。色と角丸は `src/styles/globals.css` のテーマ変数を基準にします。

A・B・`both` はTODO・予定の表示レーンです。Firebaseで実メンバーが参加するとA/Bはメンバー枠に対応しますが、担当値自体は実ユーザーIDではなく、アクセス権の判定にも使いません。共有同期の開始後はレコードをworkspaceのメンバー間で同期します。

## 技術スタック

| 分野 | 実装 |
| --- | --- |
| Web | React 19 / TypeScript 5 / Vite 7 |
| UI | Tailwind CSS v4、Radix/shadcnスタイルのローカルコンポーネント |
| ルーティング | React Router 7 |
| アイコン / モーション | Lucide React / Motion |
| 日付 | date-fns |
| 状態・保存 | React Context + `localStorage`（端末内データ・workspace別同期キュー/共有スナップショット・メンバー情報キャッシュ） + Cloud Firestore（共有データ） |
| 認証・メンバー・通知 | Firebase Authentication + Cloud Firestore + Cloud Functions（Googleログイン、workspace、共有データ、Web Push送信） |
| PWA | vite-plugin-pwa（manifest と service worker） |
| 自動テスト | Playwright + Chromium |
| CI / プレビュー | GitHub Actions / Vercel |

**未完了:** Phase 2の実環境受け入れ確認、Phase 3の2端末・オフライン・競合の実地確認、VAPID設定・Cloud Functionsデプロイ・通知のiPhone/2端末QA。Firestore Rules/indexesはデプロイ済みです。Cloud FunctionsにはBlazeプランが必要です。設定手順は[Firebaseセットアップ](docs/FIREBASE_SETUP.md)を参照してください。

## 開発環境と起動

**Node.js 22** 推奨（GitHub Actionsと同じ）。npmを使用します。

```bash
git clone https://github.com/ShunsukeOta/noca.git
cd noca
npm install
npm run dev
```

Viteの開発サーバーが起動します（通常は `http://localhost:5173`）。初期表示は `/todo` です。

Firebase Auth／Firestoreを使う場合は、`.env.example` を `.env.local` にコピーしてFirebase Web appの値を設定し、Firestore Security Rulesをデプロイしてください。詳しくは[Firebaseセットアップ](docs/FIREBASE_SETUP.md)を参照してください。値が未設定ならローカルプレビューとして起動します。

### よく使うコマンド

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | Vite開発サーバー（LANからもアクセス可能なhost指定あり） |
| `npm run typecheck` | TypeScriptプロジェクトの型チェック |
| `npm run build` | 型チェック + Vite本番ビルド |
| `npm run build:functions` | Firebase Cloud Functionsの型チェック・ビルド |
| `npm run check:bundle` | 本番ビルドの初回JS・最大チャンク・PWA保存容量を予算と比較 |
| `npm run preview` | ビルドのローカルプレビュー |
| `npx playwright install chromium` | Playwright用ブラウザを準備 |
| `npm run test:e2e` | Playwrightのブラウザテスト |
| `npm run test:pwa` | 本番ビルドの遅延読込とオフラインPWAを確認（先にビルド） |

CI（`.github/workflows/ui-check.yml`）では Node.js 22 でアプリとFunctionsの依存関係をインストールし、`npm run build` → `npm run build:functions` → `npm run check:bundle` → `npx playwright install --with-deps chromium` → `npm run test:e2e` → `npm run test:pwa` を実行します。テストのスクリーンショットと診断情報は GitHub Actions アーティファクト `noca-ui-mobile-preview` に保存されます。

> **依存関係の注意:** `package-lock.json` はコミット済みですが、CIは現在 `npm install` を使っています。CIを `npm ci` に切り替える場合は別途確認してください。

### 検証状況

今回の変更では `npm run typecheck`、`npm run build`、`npm run build:functions`、`npm run check:bundle` が成功しました。PlaywrightのローカルテストはwebServerが120秒以内に起動せず完了できませんでした。Firestore Rules/indexesは2026-10-16にFirebase `noca-df141`へデプロイ成功し、Rulesコンパイルも通過しました。Firebase実環境での二端末・iPhone通知確認は未実施です。Cloud Functions通知にはBlazeへの変更、VAPID設定、Functionsデプロイが必要です。実装コミット`1cb6d76`はmainへpushされ、GitHub上のVercelチェックが成功しました。過去のGitHub Actions記録は [#38695136243](https://github.com/ShunsukeOta/noca/actions/runs/38695136243) です。

以前のPhase 2基準では初回JavaScript **436.08 kB / gzip 139.45 kB**、最大チャンク **458.21 kB**、PWA事前保存量 **650.71 KiB / 652 KiB予算**でした。完了TODO削除を含む直近の基準値は初回JavaScript **447.53 kB / gzip 143.04 kB**、最大チャンク **455.25 kB**、PWA事前保存 **674.02 KiB / 676 KiB予算**でした。今回、Web Push UIと受信Service Workerを追加後は初回JavaScript **449.32 kB / gzip 143.45 kB**、最大チャンク **483.56 kB**、PWA事前保存 **677.48 KiB / 682 KiB予算**です。容量チェックは通過しています。通知設定チャンクは遅延読込し、初回オンライン利用後にService Workerのランタイムキャッシュへ保存します。Firebase SDK/サービスと招待ルートは事前キャッシュから除外し、Firebaseコードはオンライン利用時にランタイムキャッシュへ保存します。Firebaseメンバー情報・共有スナップショット・未送信キューを端末に保存し、共有開始後に一度オンライン利用した端末でのオフライン編集を想定します。容量は `scripts/check-bundle.mjs` でCI確認します。

320 / 375 / 390 / 430pxのモバイル幅や一部のreduced-motion、ダークモードのテストを含みます。ChromiumはiPhone Safariの証拠にはなりません。メンテナーから実機Safari/standalone QA完了の報告を受けていますが、端末・iOS版・ケース別結果はリポジトリに記録されていません。

## リポジトリ構成

```text
.
├── AGENTS.md                          # Codexに最初に読ませる指示
├── README.md                          # プロジェクトの入口（このファイル）
├── docs/
│   ├── CODEX_HANDOFF.md               # 最新の引き継ぎ・次の作業
│   ├── FIREBASE_SETUP.md               # 認証・招待・通知の接続手順と制約
│   ├── ARCHITECTURE.md                # 実装・保存・コード地図
│   ├── DESIGN_SYSTEM.md               # UI設計の決定事項
│   ├── ROADMAP.md                     # フェーズ計画
│   ├── SPECIFICATION.md               # 製品全体の構想（将来の項目含む）
│   ├── UI_QA.md                        # 実機検証計画
│   └── PHASE1{A,B,C}_REPORT.md        # 各フェーズ当時の記録
├── functions/
│   ├── src/index.ts                   # Web Push送信・期限リマインダー
│   └── .env.example                   # VAPID公開設定の例
├── firestore.indexes.json             # 通知リマインダー用collection-group index
├── src/
│   ├── App.tsx                         # ルーティング/Provider
│   ├── app/mock-data.ts               # ドメイン型とデモデータ
│   ├── features/
│   │   ├── todos/todo-store.tsx       # TODO CRUD
│   │   ├── calendar/calendar-store.tsx # 予定 CRUD
│   │   ├── notifications/             # 端末ごとのWeb Push登録・設定
│   │   ├── workspace/workspace-membership.tsx # ローカル表示とFirebaseメンバー状態
│   │   └── data/local-backup.ts       # ローカルデータの書き出し・復元
│   ├── components/
│   │   ├── app-shell.tsx              # ヘッダー、Dock、設定、編集シート
│   │   ├── editor-loaders.ts          # 編集シートの遅延読込
│   │   ├── settings-loaders.ts        # カテゴリ管理の遅延読込
│   │   ├── category-ui.tsx            # 共通カテゴリ表示・選択
│   │   ├── owner-ui.tsx               # 共通担当表示・選択
│   │   ├── calendar-day-timeline.tsx  # メンバー数に応じたタイムライン
│   │   ├── todo-editor-sheet.tsx
│   │   ├── calendar-editor-sheet.tsx
│   │   ├── undo-toast.tsx             # 共通Undo通知
│   │   └── ui/                        # Button, Input, Label, Textarea, Checkbox, Switch, Sheet等
│   ├── pages/                         # TODO, Calendar, Memo, Settings
│   └── styles/                        # CSS変数、テーマ、アニメーション
├── tests/ui.spec.ts                   # Playwright E2E
├── tests/production.spec.ts           # 本番ビルド・オフラインPWA検証
├── scripts/check-bundle.mjs           # 容量予算の検証
├── public/push-handler.js              # Service Workerの通知表示・タップ処理
├── playwright.production.config.ts    # 本番PWAテスト設定
├── .github/workflows/ui-check.yml    # CI
├── vite.config.ts                     # PWA設定/alias
└── vercel.json                        # SPAのルーティングfallback
```

実装箇所やデータフローの詳細は [ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照。

## 端末内保存の仕様・リスク

| 保存先 | 内容 |
| --- | --- |
| `noca.todos.v1` | TODO配列（カテゴリ名を各TODOに保存） |
| `noca.todo.categories.v1` | TODOカテゴリ名・色・表示順 |
| `noca.calendar.events.v1` | 予定配列（A/B/ふたり） |
| `noca.calendar.samples.v2` / `.v3` | 旧バックアップ互換用に読み出すだけのフラグ（予定の追加には使わない） |
| `noca.workspace.members.v1` | プレビュー上のメンバー状態。初期状態は「自分」1人。招待・実メンバー管理ではありません |
| `noca.shared-data.v1:{workspaceId}` | 共有データの端末内読み取りキャッシュ |
| `noca.shared-data.active.v1:{workspaceId}` | この端末で共有同期を選択した状態 |
| `noca.shared-data.imported.v1:{workspaceId}` | この端末の既存データを共有へ追加済みか |
| `noca.sync.pending.*.v1:{workspaceId}` | オフライン時を含む未送信変更キュー |
| `noca.sync.install-id.v1:{workspaceId}:{uid}` | ブラウザとアカウントごとの移行端末識別子 |
| `noca.firebase.workspace.v1:{uid}` | オフライン起動時に共有領域を特定するための最終メンバー情報 |
| `noca.theme` | ライト/ダーク |

設定から、現在のTODO・カテゴリ・予定を版番号付きJSONファイルへ書き出せます。iPhoneなどファイル共有に対応した環境では共有シートを使い、それ以外ではブラウザのファイル保存を使います。住所やメモなどの詳細と、カレンダーのサンプル移行状態も含みます。復元時は形式とデータを検証し、対象件数を確認してから現在のTODO・カテゴリ・予定を置き換えます。対応するバックアップは20MB以下の `noca.local-backup` v1です。

新しい端末のTODO・予定は空の状態から始まります。以前のバージョンが保存した既知のデモTODO・予定も初回読み込み時に取り除きます。IDとタイトルが一致する未編集サンプルだけを対象にするため、名前を変更したサンプルやそれ以外のユーザーデータは残ります。バックアップ復元・共有同期にも同じ扱いを適用します。旧カレンダー移行フラグはバックアップ形式との互換性のために保持しますが、サンプルを追加する処理はありません。

共有同期を開始していない間は、現在のブラウザでのみデータが保存されます。開始後は同じworkspaceのFirestoreデータが他のメンバー端末へ反映されます。旧localStorageは移行時に書き換えず、ログアウト後も元の端末内データとして残します。同期キューとキャッシュもブラウザ保存領域にあるため、消去前にバックアップを書き出してください。

## 開発フェーズ

| Phase | 目的 | 状態 |
| --- | --- | --- |
| 0 | コンセプト・仕様・計画 | 完了 |
| 1A | UIシェル、テーマ、ナビゲーション | **実装済み**（Phase 1E実機QA完了報告あり） |
| 1B | TODO CRUD とUI改善 | **実装済み**（Phase 1E実機QA完了報告あり） |
| 1C | カレンダー CRUD、初期1人・2人状態に応じたタイムライン | **実装済み**（Phase 1E実機QA完了報告あり） |
| **1D** | **メモ機能** | **保留**。メモタブと「開発中です」の案内のみ。作成・編集・保存はなし |
| 1E | iPhone Safari / Home Screen PWAでの実機レビュー | メンテナーから完了報告あり（詳細未記録） |
| 2 | Googleログイン、2人の共有スペース・招待 | ソース実装済み。Firebase接続と2アカウント確認が必要 |
| 3 | FirestoreによるTODO・予定の共有CRUD・同期・競合対策 | ソース実装済み。Rules/indexesデプロイ済み。2端末・オフライン・競合確認が必要 |
| 4 | PWAオフライン挙動・通知など | 未完了 |
| 5 | 本番QA・リリース | 未完了 |

以前のプレビューが書き込んだ `noca.notes.v1` がある場合も、この版では読み書きせず、削除もしません。

**次に着手するエージェントは [CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md) と [FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) を参照**し、ブラウザ検証、Phase 2/3の実環境受け入れ確認、Blaze設定後のVAPID/Functionsデプロイを進めてください。

## ドキュメント一覧

- [AGENTS.md](AGENTS.md) — エージェント向けの必須指示
- [CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md) — **いま何をすればよいか**
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — **どこを変更すればよいか**
- [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — デザイン・画面構成
- [SPECIFICATION.md](docs/SPECIFICATION.md) — 製品要件と将来の構想
- [ROADMAP.md](docs/ROADMAP.md) — フェーズ・受け入れ条件
- [UI_QA.md](docs/UI_QA.md) — Chromium/実機確認項目
- [Phase 1A](docs/PHASE1A_REPORT.md) / [Phase 1B](docs/PHASE1B_REPORT.md) / [Phase 1C](docs/PHASE1C_REPORT.md) — **当時の**検証記録

## 範囲と既存リポジトリ

旧 [realtime-todos](https://github.com/ShunsukeOta/realtime-todos) は参照用であり、**nocaの作業で旧コード・DB・デプロイ先を変更しません**。独自チャット、AI機能、習慣トラッカー、分析ダッシュボード、複数ワークスペース切替は当面の対象外です。

---
**Last reviewed against implementation:** 2026-10-16 · **Status:** implementation commit `1cb6d76` pushed; Vercel check and Firebase Rules/indexes deploy succeeded. Firebase account/two-device acceptance and Blaze-gated push Functions remain; memo feature deferred.
