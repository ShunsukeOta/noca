# noca

**ふたりの「やること・予定・メモ」を、ひとつの場所に。**

noca は、2人で使うことを目指す **iPhoneファーストの日本語PWA** です。メイン画面は **TODO / カレンダー / メモ** の3つ。スマホの片手操作・落ち着いたデザイン・必要十分な情報密度を重視しています。

**プレビュー:** https://noca-delta.vercel.app  
**ソース:** https://github.com/ShunsukeOta/noca  
**開発状況:** TODO・カレンダーの端末内機能とUIを実装済み。メモタブは残し、現在は「メモ機能は開発中です」と案内するプレースホルダーです。

> [!IMPORTANT]
> **これは「2人で共有できる完成版」ではありません。** 現在は同一ブラウザの `localStorage` を使うUIプレビューです。TODOと予定はこの端末で追加・編集・削除できます。メモ機能は開発中で、ログイン、招待、実際の2端末間同期、Firebase、通知も未実装です。ブラウザの保存データを消すと端末内の編集内容も消えます。

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
| **カレンダー** | **動作**・端末内に保存 | 月移動・日付選択、予定の作成/編集/削除/Undo、終日・開始/終了・担当A/B/ふたり、期限付きTODOの参照。終日予定がない日は終日欄を省略 |
| **2人用日別タイムライン** | **動作するUIプレビュー** | A/Bの2列と時間軸、A+B全幅の共有予定、共有の終日予定を2列幅で表示。同じ担当者の重なりはグループ内で最長の予定を表示し、担当色の「他N件」チップから時刻順の一覧を開けます |
| **メモ** | **開発中** | メモタブを開くと「メモ機能は開発中です」と表示。入力や保存の操作はありません。 |
| **設定** | テーマ・TODOカテゴリが動作 | ライト／ダークの切替と、TODOカテゴリの管理。共有・招待・通知・クラウド同期は「準備中」 |
| **PWA** | 基本構成あり | manifest / service workerの自動更新設定。iPhone Safari・ホーム画面standalone実機QAやオフライン同期は未完了 |

### UIで守るべき重要な決定

- **上部：** スクロールしても残る固定ヘッダー。nocaロゴの隣に**今日の日付**、右にA/B仮アバターと設定アイコン。設定画面では設定アイコンが「×」になり、開く前の画面へ戻れます。
- **下部：** 左の白いフローティングボックスに **TODO / カレンダー / メモ**。TODO/カレンダーでは**16px離れた右側に独立した濃色の＋ボタン**。メモは開発中表示のため＋を隠します。設定画面ではグローバルメニュー全体を非表示にします。
- **TODO：** 最初に「すべて」と設定済みカテゴリの2段ボタン。初期カテゴリはおでかけ・暮らし・ふたり・その他で、設定から追加・編集できます。カテゴリタグと同じ色。大きな「残りのタスク」ボックスと「これからすること ○件」の見出しはありません。
- **カレンダー：** 月間グリッドの下に透明背景の**A/B 2列タイムライン**。終日でも**第3列「ふたりの予定」は置かず**、A/B/ふたりすべてに終日予定がない日は終日欄を省略します。共有予定は終日・時刻付きともA+Bの2列にまたがる横長表示。1時間=54px、単独表示の短い予定は最小36px。同じ担当者の時間重複はグループ内で最長の予定を開始時刻どおりに表示し、担当色の「他N件」チップから正確な時刻付き一覧を開きます。
- **入力：** 角丸のボトムシート。iPhoneでキーボードが出たら `visualViewport` に応じて移動し、保存ボタンを見失わない設計。開いた直後の自動フォーカスはしません。
- **動き：** Motionによる自然なアニメーション。`prefers-reduced-motion` を尊重。ライト・ダーク両テーマ対応。
- **共通UI：** 入力・ラベル・ボタン・チェック・スイッチ・担当/カテゴリ選択・破棄確認・Undo通知をローカルの共通部品で管理。色と角丸は `src/styles/globals.css` のテーマ変数を基準にします。

A・B・`both` は**デモ用の予定所有者ラベル**です。現段階では本人認証・閲覧権限・共有相手との同期を意味しません。

## 技術スタック

| 分野 | 実装 |
| --- | --- |
| Web | React 19 / TypeScript 5 / Vite 7 |
| UI | Tailwind CSS v4、Radix/shadcnスタイルのローカルコンポーネント |
| ルーティング | React Router 7 |
| アイコン / モーション | Lucide React / Motion |
| 日付 | date-fns |
| 状態・保存 | React Context + `localStorage`（TODO / 予定 / TODOカテゴリ） |
| PWA | vite-plugin-pwa（manifest と service worker） |
| 自動テスト | Playwright + Chromium |
| CI / プレビュー | GitHub Actions / Vercel |

**未導入:** Firebase Authentication、Firestore、実運用の共有スペース、プッシュ通知。将来の技術方針は [仕様書](docs/SPECIFICATION.md) にありますが、未実装のものと混同しないでください。

## 開発環境と起動

**Node.js 22** 推奨（GitHub Actionsと同じ）。npmを使用します。

```bash
git clone https://github.com/ShunsukeOta/noca.git
cd noca
npm install
npm run dev
```

Viteの開発サーバーが起動します（通常は `http://localhost:5173`）。初期表示は `/todo` です。

### よく使うコマンド

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | Vite開発サーバー（LANからもアクセス可能なhost指定あり） |
| `npm run typecheck` | TypeScriptプロジェクトの型チェック |
| `npm run build` | 型チェック + Vite本番ビルド |
| `npm run preview` | ビルドのローカルプレビュー |
| `npx playwright install chromium` | Playwright用ブラウザを準備 |
| `npm run test:e2e` | Playwrightのブラウザテスト |

CI（`.github/workflows/ui-check.yml`）では Node.js 22 で `npm install` → `npm run build` → `npx playwright install --with-deps chromium` → `npm run test:e2e` を実行します。テストのスクリーンショットと診断情報は GitHub Actions アーティファクト `noca-ui-mobile-preview` に保存されます。

> **依存関係の注意:** `package-lock.json` はコミット済みですが、CIは現在 `npm install` を使っています。CIを `npm ci` に切り替える場合は別途確認してください。

### テスト状況

このREADME更新前の最新成功ランは [GitHub Actions #38532471385](https://github.com/ShunsukeOta/noca/actions/runs/38532471385) で、**ビルド成功・Playwright Chromium 43件すべて成功**です。変更後は必ず新しいCIランを確認してください。

320 / 375 / 390 / 430pxのモバイル幅や一部のreduced-motion、ダークモードのテストを含みます。**Chromiumのモバイルエミュレーション ≠ iPhone Safari実機/standaloneの合格**です。実機確認は [UIテスト計画](docs/UI_QA.md) に沿って別途行います。

## リポジトリ構成

```text
.
├── AGENTS.md                          # Codexに最初に読ませる指示
├── README.md                          # プロジェクトの入口（このファイル）
├── docs/
│   ├── CODEX_HANDOFF.md               # 最新の引き継ぎ・次の作業
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
│   │   └── calendar/calendar-store.tsx # 予定 CRUD
│   ├── components/
│   │   ├── app-shell.tsx              # ヘッダー、Dock、設定、編集シート
│   │   ├── category-ui.tsx            # 共通カテゴリ表示・選択
│   │   ├── owner-ui.tsx               # 共通担当表示・選択
│   │   ├── calendar-day-timeline.tsx  # 2人用タイムライン/重なり計算
│   │   ├── todo-editor-sheet.tsx
│   │   ├── calendar-editor-sheet.tsx
│   │   ├── undo-toast.tsx             # 共通Undo通知
│   │   └── ui/                        # Button, Input, Label, Textarea, Checkbox, Switch, Sheet等
│   ├── pages/                         # TODO, Calendar, Memo, Settings
│   └── styles/                        # CSS変数、テーマ、アニメーション
├── tests/ui.spec.ts                   # Playwright E2E
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
| `noca.theme` | ライト/ダーク |

新規端末にはサンプル予定/TODOが表示されます。以前からサンプルが残る端末にはカレンダーの追加デモを一度だけ取り込む処理があります。**有効な保存済みの空配列は空のまま**です。

現在のブラウザでのみデータが保存されます。スマホとPC、異なるブラウザや別オリジン間での同期・データ共有はありません。テストや変更時にローカル保存データを破壊しないでください。

## 開発フェーズ

| Phase | 目的 | 状態 |
| --- | --- | --- |
| 0 | コンセプト・仕様・計画 | 完了 |
| 1A | UIシェル、テーマ、ナビゲーション | **実装済み**（実機未確認） |
| 1B | TODO CRUD とUI改善 | **実装済み**（実機未確認） |
| 1C | カレンダー CRUD、A/B/ふたりのタイムラインと各種改修 | **実装済み**（実機未確認） |
| **1D** | **メモ機能** | **保留**。メモタブと「開発中です」の案内のみ。作成・編集・保存はなし |
| 1E | iPhone Safari / Home Screen PWAでの実機レビュー | 未完了 |
| 2 | Googleログイン、2人の共有スペース・招待 | 未実装 |
| 3 | Firestoreによる共有CRUD・同期・競合対策 | 未実装 |
| 4 | PWAオフライン挙動・通知など | 未完了 |
| 5 | 本番QA・リリース | 未完了 |

以前のプレビューが書き込んだ `noca.notes.v1` がある場合も、この版では読み書きせず、削除もしません。

**次に着手するエージェントは [CODEX_HANDOFF.md](docs/CODEX_HANDOFF.md) を必ず参照**し、Phase 1Dは保留、次の対象はPhase 1Eであることを確認してください。

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
**Last reviewed against implementation:** 2026-10-15 · **Status:** Local UI preview / memo feature deferred; Phase 1E QA next.
