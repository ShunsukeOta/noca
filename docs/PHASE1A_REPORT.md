# Phase 1A 実装・検証記録

更新: 2026-10-14

## 実装済み（ソースコード）

- React + Vite + TypeScriptのアプリ基盤
- Tailwind CSS v4、shadcn/uiスタイルのRadix版Button / Sheet
- CSS変数によるnocaライト/ダークのカラートークン
- TODO / カレンダー / メモの下部3タブと共通ヘッダー・FAB
- iPhone向けSafe Area、タッチ領域、16pxのフォーム入力文字
- TODO、カレンダー、メモのダミーデータ表示
- TODOのデモ完了/解除、簡易フィルター、カレンダー月移動、メモ検索
- 追加シートは表示専用。**保存はまだ行わない**
- PWA manifest / Service Workerセットアップ（本格的なオフライン保証はPhase 4）
- Playwrightの375/390/430pxスモークテスト定義とGitHub Actionsワークフロー

## UIと技術上の境界

- アカウント、招待、Firestore連携は **未実装**
- TODOのCRUD/永続化は **Phase 1B**
- カレンダー予定編集は **Phase 1C**
- メモ編集は **Phase 1D**
- 実機Safari / ホーム画面PWA確認は **Phase 1E**
- 素材・カラー・数値は承認前の暫定値
- テーマ選択は端末のlocalStorageを使うが、共有やタスクデータの保存ではない

## 自動確認コマンド

~~~bash
npm install
npm run build
npx playwright install chromium
npm run test:e2e
~~~

GitHub Actionsの`UI checks`ワークフローでもビルドとChromiumモバイル表示を検証する。
CI成功と**iPhone実機の表示確認は別物**。iOS Safari固有のレイアウト・PWA動作をCIだけで合格としない。

## Phase 1Aの判定

| 項目 | 状態 |
| --- | --- |
| 初期構築のソース | 実装済み |
| shadcn/uiスタイルのコンポーネント | 実装済み |
| 3タブと共通シェル | 実装済み |
| ダミーデータ | 実装済み |
| ビルド成功 | PASS — TypeScript/Vite本番ビルド |
| 375 / 390 / 430pxの表示 | PASS — Chromiumモバイル表示、横はみ出しなし |
| iPhone Safari実機 | Phase 1Eで検証 |
| PWA standalone実機 | Phase 1Eで検証 |

## CI確認結果

- GitHub Actions: https://github.com/ShunsukeOta/noca/actions/runs/38505171729
- Typecheck / Vite build: 成功
- Playwright Chromiumモバイル画面: 375 / 390 / 430px 全合格
- タブ/カレンダー月切り替え/プレビューシート/ダークテーマ/TODOチェック/メモ検索: 全合格
- 最終CIではTODO・カレンダー・メモの各画面キャプチャを成果物として出力
- **Safari実機やPWA standaloneは未実施**。Phase 1Eまで合格扱いにしない

## 次に進める順序

1. CIのビルド・ブラウザテストを確認し、必要な修正
2. 機能を増やさずUIを一度レビュー
3. Phase 1BでTODOの実際の追加・編集・完了・Undoを実装
4. Phase 1C、1Dの順で機能・画面を作成
5. Phase 1Eで実機テストとデザイン確定

---
**確認できていないテストを合格扱いにしないこと。**
