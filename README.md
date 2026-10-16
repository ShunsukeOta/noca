# noca

**ふたりの「やること・予定・メモ」を、ひとつの場所に。**

noca は、2人で使うことを目指す **iPhoneファーストの日本語PWA** です。メイン画面は **TODO / カレンダー / メモ** の3つ。スマホの片手操作・落ち着いたデザイン・必要十分な情報密度を重視しています。

**プレビュー:** https://noca-delta.vercel.app  
**ソース:** https://github.com/ShunsukeOta/noca  
**開発状況:** TODO・カレンダーは端末内機能を実装済み。Googleログインと2人のメンバー参加を実装中です。メモタブは残し、「メモ機能は開発中です」と案内するプレースホルダーです。

> [!IMPORTANT]
> **まだTODO・予定を2人で共有する完成版ではありません。** Firebaseの環境変数がない状態では、同一ブラウザの `localStorage` を使う1人用プレビューです。Firebaseを設定するとGoogleログイン、共有スペース作成、招待リンク参加が使えますが、TODO・予定は引き続き端末内保存で、クラウド同期・既存データ移行は未実装です。初期状態ではBの表示・担当選択・2人比較画面は出ません。メモ機能は開発中で、通知も未実装です。設定からJSONバックアップを書き出して復元できますが、復元は現在のTODO・カテゴリ・予定を置き換えます。ブラウザの保存データを消すと端末内の編集内容も消えます。Firebaseの設定は[セットアップ手順](docs/FIREBASE_SETUP.md)を参照してください。

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
| **TODO** | **動作**・端末内に保存 | 作成・編集・完了/解除・削除/Undo。カテゴリは設定から追加・名前変更・色変更・並び替え・削除ができ、削除時はTODOを別カテゴリへ移動。 |
| **カレンダー** | **動作**・端末内に保存 | 月移動・日付選択、予定の作成/編集/削除/Undo、終日・開始/終了、期限付きTODOの参照。初期状態は担当表示のない1人用タイムライン。実メンバーが2人参加するとA/B比較表示になりますが、予定自体の共有同期は未実装です |
| **メモ** | **開発中** | メモタブを開くと「メモ機能は開発中です」と表示。入力や保存の操作はありません。 |
| **設定** | テーマ・TODOカテゴリ・端末内バックアップ、Firebase設定時は認証とメンバー参加 | 初期状態は「自分」1人。Googleログイン、共有スペース作成、24時間有効の招待リンクを実装。TODO・予定の共有同期は未実装 |
| **PWA** | 基本構成あり | manifest / service workerの自動更新設定。メンテナーからiPhone Safari・ホーム画面standalone実機QA完了の報告あり（端末と個別結果は未記録）。オフライン同期は未実装 |

### UIで守るべき重要な決定

- **上部：** スクロールしても残る固定ヘッダー。nocaロゴの隣に**今日の日付**、右に現在のメンバーと設定アイコン。初期状態は「自分」1人だけを表示し、設定画面では設定アイコンが「×」になって開く前の画面へ戻れます。
- **下部：** 左の白いフローティングボックスに **TODO / カレンダー / メモ**。TODO/カレンダーでは**16px離れた右側に独立した濃色の＋ボタン**。メモは開発中表示のため＋を隠します。設定画面ではグローバルメニュー全体を非表示にします。
- **TODO：** 最初に「すべて」と設定済みカテゴリの2段ボタン。初期カテゴリはおでかけ・暮らし・ふたり・その他で、設定から追加・編集できます。カテゴリタグと同じ色。大きな「残りのタスク」ボックスと「これからすること ○件」の見出しはありません。
- **カレンダー：** 初期状態は担当見出しを置かない1列タイムラインです。2人のメンバーがいる場合はA/Bの2列になり、共有予定は終日・時刻付きとも全幅で表示します。1時間=54px、単独表示の短い予定は最小36px。同一担当の時間重複は最長の予定を表示し、「他N件」チップから正確な時刻付き一覧を開きます。
- **入力：** 角丸のボトムシート。iPhoneでキーボードが出たら `visualViewport` に応じて移動し、保存ボタンを見失わない設計。開いた直後の自動フォーカスはしません。
- **動き：** Motionによる自然なアニメーション。`prefers-reduced-motion` を尊重。ライト・ダーク両テーマ対応。
- **共通UI：** 入力・ラベル・ボタン・チェック・スイッチ・担当/カテゴリ選択・破棄確認・Undo通知をローカルの共通部品で管理。色と角丸は `src/styles/globals.css` のテーマ変数を基準にします。

A・B・`both` は予定の表示レーンです。Firebaseで実メンバーが参加するとA/Bはメンバー枠に対応しますが、TODO・予定レコードの担当情報はまだ実ユーザーIDに結び付かず、他端末との共有同期もありません。

## 技術スタック

| 分野 | 実装 |
| --- | --- |
| Web | React 19 / TypeScript 5 / Vite 7 |
| UI | Tailwind CSS v4、Radix/shadcnスタイルのローカルコンポーネント |
| ルーティング | React Router 7 |
| アイコン / モーション | Lucide React / Motion |
| 日付 | date-fns |
| 状態・保存 | React Context + `localStorage`（TODO / 予定 / TODOカテゴリ） |
| 認証・メンバー | Firebase Authentication + Cloud Firestore（環境設定がある場合。TODO/予定保存には未使用） |
| PWA | vite-plugin-pwa（manifest と service worker） |
| 自動テスト | Playwright + Chromium |
| CI / プレビュー | GitHub Actions / Vercel |

**未完了:** Firebaseプロジェクトとの接続、TODO/予定のFirestore CRUD・同期、ローカルからのデータ移行、プッシュ通知。本番データベースや認証プロバイダーの設定手順は[Firebaseセットアップ](docs/FIREBASE_SETUP.md)を参照してください。

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
| `npm run check:bundle` | 本番ビルドの初回JS・最大チャンク・PWA保存容量を予算と比較 |
| `npm run preview` | ビルドのローカルプレビュー |
| `npx playwright install chromium` | Playwright用ブラウザを準備 |
| `npm run test:e2e` | Playwrightのブラウザテスト |
| `npm run test:pwa` | 本番ビルドの遅延読込とオフラインPWAを確認（先にビルド） |

CI（`.github/workflows/ui-check.yml`）では Node.js 22 で `npm install` → `npm run build` → `npm run check:bundle` → `npx playwright install --with-deps chromium` → `npm run test:e2e` → `npm run test:pwa` を実行します。テストのスクリーンショットと診断情報は GitHub Actions アーティファクト `noca-ui-mobile-preview` に保存されます。

> **依存関係の注意:** `package-lock.json` はコミット済みですが、CIは現在 `npm install` を使っています。CIを `npm ci` に切り替える場合は別途確認してください。

### テスト状況

現在のPhase 2ソースは `npm run build`、`npm run check:bundle`、Playwright Chromium **50/50件**、production PWA **4/4件**を通過しています。ローカルテストはFirebase未設定のプレビュー動作です。Firebaseプロジェクト側ではGoogle Auth、Firestore、Rules、Vercel Production/Previewのクライアント設定を準備済みで、デプロイ後のログイン・招待フロー確認が残っています。過去のGitHub Actions記録は [#38695136243](https://github.com/ShunsukeOta/noca/actions/runs/38695136243) です。

初回JavaScriptは **436.08 kB / gzip 139.45 kB**、最大チャンクは **458.21 kB**です。カレンダー、編集シート、カテゴリ管理、Firebaseの認証ブリッジとMotionのレイアウト機能を必要時に読み込みます。ネットワークが必要なFirebase SDK/サービスと招待ルートはPWA事前キャッシュから除外し、TODO・カレンダーと編集画面のオフライン動作を維持します。PWA事前保存量は **650.71 KiB / 652 KiB予算**です。容量の予算は `scripts/check-bundle.mjs` でCIでも確認します。

320 / 375 / 390 / 430pxのモバイル幅や一部のreduced-motion、ダークモードのテストを含みます。ChromiumはiPhone Safariの証拠にはなりません。メンテナーから実機Safari/standalone QA完了の報告を受けていますが、端末・iOS版・ケース別結果はリポジトリに記録されていません。

## リポジトリ構成

```text
.
├── AGENTS.md                          # Codexに最初に読ませる指示
├── README.md                          # プロジェクトの入口（このファイル）
├── docs/
│   ├── CODEX_HANDOFF.md               # 最新の引き継ぎ・次の作業
│   ├── FIREBASE_SETUP.md               # 認証・招待の接続手順と制約
│   ├── ARCHITECTURE.md                # 実装・保存・コード地図
│   ├── DESIGN_SYSTEM.md               # UI設計の決定事項
│   ├── ROADMAP.md                     # フェーズ計画
│   ├── SPECIFICATION.md               # 製品全体の構想（将来の項目含む）
│   ├── UI_QA.md                        # 実機検証計画
│   └── PHASE1{A,B,C}_REPORT.md        # 各フェーズ当時の記録
├── src/
│   ├── App.tsx                         # ルーティング/Provider
│   ├── app/mock-data.ts               # ドメイン型とデモデータ
│   ├── features/
│   │   ├── todos/todo-store.tsx       # TODO CRUD
│   │   ├── calendar/calendar-store.tsx # 予定 CRUD
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
| `noca.calendar.samples.v2` / `.v3` | 旧デモ予定からの一度きりのサンプル追加フラグ |
| `noca.workspace.members.v1` | プレビュー上のメンバー状態。初期状態は「自分」1人。招待・実メンバー管理ではありません |
| `noca.theme` | ライト/ダーク |

設定から、現在のTODO・カテゴリ・予定を版番号付きJSONファイルへ書き出せます。iPhoneなどファイル共有に対応した環境では共有シートを使い、それ以外ではブラウザのファイル保存を使います。住所やメモなどの詳細と、カレンダーのサンプル移行状態も含みます。復元時は形式とデータを検証し、対象件数を確認してから現在のTODO・カテゴリ・予定を置き換えます。対応するバックアップは20MB以下の `noca.local-backup` v1です。

新規端末にはサンプル予定/TODOが表示されます。以前からサンプルが残る端末にはカレンダーの追加デモを一度だけ取り込む処理があります。**有効な保存済みの空配列は空のまま**です。

現在のブラウザでのみデータが保存されます。スマホとPC、異なるブラウザや別オリジン間での同期・データ共有はありません。テストや変更時にローカル保存データを破壊しないでください。

## 開発フェーズ

| Phase | 目的 | 状態 |
| --- | --- | --- |
| 0 | コンセプト・仕様・計画 | 完了 |
| 1A | UIシェル、テーマ、ナビゲーション | **実装済み**（Phase 1E実機QA完了報告あり） |
| 1B | TODO CRUD とUI改善 | **実装済み**（Phase 1E実機QA完了報告あり） |
| 1C | カレンダー CRUD、初期1人・2人状態に応じたタイムライン | **実装済み**（Phase 1E実機QA完了報告あり） |
| **1D** | **メモ機能** | **保留**。メモタブと「開発中です」の案内のみ。作成・編集・保存はなし |
| 1E | iPhone Safari / Home Screen PWAでの実機レビュー | メンテナーから完了報告あり（詳細未記録） |
| 2 | Googleログイン、2人の共有スペース・招待 | 実装中。Firebase接続と2アカウント確認が必要 |
| 3 | Firestoreによる共有CRUD・同期・競合対策 | 未実装 |
| 4 | PWAオフライン挙動・通知など | 未完了 |
| 5 | 本番QA・リリース | 未完了 |

以前のプレビューが書き込んだ `noca.notes.v1` がある場合も、この版では読み書きせず、削除もしません。

**次に着手するエージェントは [CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md) と [FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) を参照**し、Firebase接続と招待フローの受け入れ確認を進めてください。TODO・予定の共有CRUDと既存データ移行はPhase 3です。

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
**Last reviewed against implementation:** 2026-10-15 · **Status:** Local data preview with Firebase Auth/workspace membership in progress; memo feature deferred.
