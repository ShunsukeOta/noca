# noca

**ふたりの「やること・予定・メモ」を、ひとつの場所に。**

noca は、2人で使うことを前提とした **iPhone向け共有PWA** です。TODO・カレンダー・メモを、直感的な3タブにまとめます。

> [!IMPORTANT]
> 現在は **Phase 1A: UI基盤実装・Chromium自動テスト合格**。アプリの3画面とダミーUIを追加しました。Firebase・デプロイはまだ実装していません。
> 次は **Phase 1B: TODO CRUD UI** に進みます。iPhone実機のSafari / standalone表示検証はPhase 1Eで行います。旧リポジトリ `realtime-todos` のコード・DBは変更しません。

## コンセプト

- **シンプル:** タスクを登録・完了する操作を最短にし、設定や入力項目を増やさない
- **ふたりで共有:** 初回ペアリング後は、TODO・予定・メモが自動的に同期される
- **iPhoneファースト:** Safari / ホーム画面に追加したPWAでの操作感を最優先する
- **3画面だけ:** 下部タブ「TODO」「カレンダー」「メモ」。設定は別途小さな導線にまとめる
- **使える品質:** オフライン復帰、誤操作からの復元、読みやすさ・アクセシビリティも重視する

## 予定している技術スタック

| 用途 | 技術 |
| --- | --- |
| UI / 言語 | React + TypeScript + Vite |
| デザイン | shadcn/ui + Tailwind CSS v4 |
| アイコン / アニメーション | Lucide React + Motion |
| ルーティング / 日付 | React Router + date-fns |
| 認証 / 共有 / DB | Firebase Authentication + Cloud Firestore |
| PWA | vite-plugin-pwa |
| 公開 | Firebase Hosting（予定） |

※ フェーズ1は**ダミーデータのみ**。Firebase・認証・招待・同期はフェーズ2以降に導入します。ライブラリのバージョンは実装開始時に安定版を検証して固定します。

## アプリの3画面

| 画面 | 概要 |
| --- | --- |
| TODO | 一覧、クイック追加、完了、タグ、期限、編集シート |
| カレンダー | 月表示、日付選択、その日の予定、期限つきTODOの表示 |
| メモ | 共有メモ一覧、検索、作成・編集、ピン留め（後続フェーズ） |

**予定とTODOは別データ**です。予定日が設定されたTODOはカレンダーにも「参照表示」しますが、同じデータを二重に保存しません。

## フェーズ

| フェーズ | 目的 | 状態 |
| --- | --- | --- |
| 0 | 仕様・計画・受け入れ基準の文書化 | 完了（ドキュメント整備） |
| 1A | 初期構築・デザイントークン・下部タブ | 実装済み・Chromium自動テスト合格 |
| 1B | TODO画面UI | 未着手 |
| 1C | カレンダー画面UI | 未着手 |
| 1D | メモ画面UI | 未着手 |
| 1E | iPhone表示テストとUI確定 | 未着手 |
| 2 | Firebase認証・2人の共有スペース・招待 | 未着手 |
| 3 | 共有CRUD・リアルタイム同期・競合対策 | 未着手 |
| 4 | PWA最適化・オフライン検証・通知検討 | 未着手 |
| 5 | 本番検証・リリース | 未着手 |

詳細: [フェーズ別開発計画](docs/ROADMAP.md)

## ドキュメント

- [製品・機能・データ設計仕様書](docs/SPECIFICATION.md)
- [フェーズ別開発計画と完了条件](docs/ROADMAP.md)
- [UIデザインシステム](docs/DESIGN_SYSTEM.md)
- [iPhone表示・操作テスト計画](docs/UI_QA.md)

## 開発方針

1. **仕様 → ダミーUI → 実機確認 → デザイン承認 → データ接続** の順で進める。
2. Phase 1 ではFirebaseに接続せず、表示と操作に集中する。
3. 画面を増やさない。メイン導線は3タブ、編集は下部シートを基本とする。
4. デスクトップ向けUIは今回の対象外。スマホ幅で崩れないことを優先する。
5. 変更は小さなPR単位に分割し、各フェーズの受け入れ条件を確認する。
6. 秘密情報をコミットしない。環境変数は `.env.example` にキー名だけ掲載する。

## ローカル起動（Phase 1A）

Node.js 22以上を推奨します。

~~~bash
npm install
npm run dev
~~~

画面表示を確認したら次を実行できます。

~~~bash
npm run build
npx playwright install chromium
npm run test:e2e
~~~

初期表示は `/todo`。下部タブで `/calendar`、`/memo` に切り替わります。右下の＋ボタンは追加シートの**表示デモ**で、保存は行いません。

shadcn/uiの **Radix版** を採用し、ソースを `src/components/ui` に配置しています。カラー・角丸等は `src/styles/globals.css` で共通管理します。詳細: [Phase 1A 実装・検証記録](docs/PHASE1A_REPORT.md)。

実機確認はiPhoneの **Safari表示** と **ホーム画面追加後のstandalone表示** の両方を対象とします。CIのChromiumモバイル検証だけではiOS実機合格とはしません。

## 範囲外（初期リリース）

独自チャット、AI、習慣トラッカー、分析ダッシュボード、複数ワークスペース切替、Android / ネイティブアプリ、デスクトップ専用レイアウト。

## 既存アプリとの関係

旧 [realtime-todos](https://github.com/ShunsukeOta/realtime-todos) は参照用です。データの引き継ぎが必要になれば、事前バックアップと移行方針の承認を経て後続フェーズで実施します。

---
**Last updated:** 2026-10-14 · **Status:** Specification first / UI first
