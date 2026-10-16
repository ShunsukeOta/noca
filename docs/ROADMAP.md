# noca — フェーズ別開発計画

- Version: 0.1
- Updated: 2026-10-16
- Current: **Phase 3の主要コードを実装済み、受け入れ確認は未完了**。Phase 2のFirebase実環境確認も未完了。Phase 1Eはメンテナーから完了報告あり。メモ機能は保留
- Current local verification: `npm run typecheck`・`npm run build`・`npm run check:bundle` は成功。Playwright E2E/PWA、Firestore Rules emulator/deploy、Firebase実環境と二端末の確認は未実施。Phase 2の過去基準はPlaywright **50/50**、production PWA **4/4**。Earlier CI baseline: [GitHub Actions #38695136243](https://github.com/ShunsukeOta/noca/actions/runs/38695136243).
- Product spec: [SPECIFICATION.md](SPECIFICATION.md)
- UI tokens: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- UI verification: [UI_QA.md](UI_QA.md)

## 基本原則

- フェーズを跨いだ先行実装を避ける。各フェーズの **DoD (Definition of Done)** を満たし、確認後に次へ進む。
- **Phase 1A–1Eは完了済みのUIプレビュー段階。** メンテナーからiPhone Safari/ホーム画面PWA QA完了の報告あり（個別記録は未掲載）。TODO/予定はデモ起点の`localStorage` CRUD。メモ機能は保留中。
- フェーズ1で固定するのは画面の情報設計・外観・タップ操作。公開後のデータモデルまでは凍結しない。
- 旧realtime-todosのコード・DB・公開環境を変更しない。
- 作業は原則ブランチ/PRごとに小さく分割。画面キャプチャとテスト結果を残してレビュー可能にする。
- `package-lock.json`はコミット済み。CIは現在`npm install`を使用しており、`npm ci`への切り替えは別途確認する。
- 不明点は暫定判断と明記し、理由・確定日を文書に残す。

## 全体ロードマップ

| Phase | 作業内容 | 依存 | 完了条件 |
| --- | --- | --- | --- |
| **0** | README・仕様・ロードマップ・UIテスト計画 | なし | READMEと4つのdocs文書が整備され、Phase 1の合格基準が明確 |
| **1A** | Vite/React/TypeScript/shadcn/ui/Tailwind、画面枠、3タブ | 0 | 実装済み・ビルドとChromium自動テスト合格（実機確認は1E） |
| **1B** | TODO UIとローカルCRUD・ユーザー管理カテゴリ | 1A | **実装済み**。カテゴリの追加/編集/色/並び順/削除とTODO移動を端末内保存（Safari実機は1E） |
| **1C** | カレンダーCRUD・メンバー数に応じた時間表示 | 1B | **実装済み**。初期1人状態は1列、2人状態はA/B比較UI。Safari/PWA実機は1E |
| **1D** | メモ機能 | 1C | **保留**。メモタブは残すが、一覧・作成・保存などは実装しない。用途とTODO/予定との役割を再検討してから再開 |
| **1E** | iPhone実機・Safari/PWA表示確認、UI最終調整 | 1C | **完了（メンテナー報告）**。端末・ケース別記録は未掲載 |
| **2** | Firebase Auth・workspace・メンバーシップ・招待 | 1E | ソース実装済み。Firebase設定後、1人利用→招待→2人参加とサーバー側権限制限を実機確認 |
| **3** | FirestoreのCRUD・共有同期・競合対策 | 2 | TODO/予定/カテゴリの共有CRUD・移行・競合・オフライン動作を実装中。Rulesデプロイと実機受け入れが必要 |
| **4** | PWA実運用最適化、オフライン、通知検討 | 3 | ホーム画面PWA・再接続・更新・通知（採用時）を検証 |
| **5** | 本番QA・リリース・運用 | 4 | リリースチェック合格、データ保護確認 |

## Phase 0 — 設計ドキュメント

### 成果物

- [README.md](../README.md)
- [SPECIFICATION.md](SPECIFICATION.md)
- [ROADMAP.md](ROADMAP.md)
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- [UI_QA.md](UI_QA.md)

### 完了条件

- [x] アプリの目的、主要画面、対象プラットフォームを明文化
- [x] 技術スタック候補・UI-first方針を記述
- [x] フェーズ別の実施順・受け入れ基準を記述
- [x] UIテストの観点と実機チェックシートを作成
- [ ] ビジュアルデザインの最終承認（Phase 1Eで実施）

## Phase 1A — プロジェクト基盤と共通シェル

### スコープ

- Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui の初期構築
- ライブラリ: Lucide React、Motion、date-fns、React Router
- 3タブ固定（TODO/カレンダー/メモ）、共通ヘッダー。追加ボタンはTODO/カレンダーで表示し、メモタブでは隠す
- ライト/ダークテーマの共通トークン
- iPhone Safe Area対応、スクロール領域、キーボード時レイアウト
- 最小限のPWA起動要件をセットアップ（PWAの完成・オフライン保証はPhase 4）
- ダミーデータ/モック状態だけで起動可能にする

### DoD

- [x] `npm install` / `npm run build` がCIで正常（`npm run dev` はE2Eで起動確認）
- [x] TODO/カレンダー/メモのタブ切替ができる
- [ ] 画面下部タブがホームインジケーターと重ならない
- [x] 375px / 390px / 430px幅で横スクロールしない（Chromium自動テスト）
- [ ] 日本語入力時のズーム/キーボード重なりを回避
- [x] 本フェーズにFirebase SDKへの接続コードを含まない

## Phase 1B — TODO UI

### スコープ

- 未完了/完了の一覧、クイック追加、詳細シート
- タイトル/期限/カテゴリ/任意詳細（メモ、URL、場所）
- ダミー操作: 作成・更新・完了/戻す・削除/Undo
- 空状態、長文、件数が多い状態、入力エラーの表示
- 最小限のフィルター、作成者アイコンの参考表示

### DoD

- [ ] タイトルだけでTODOが作れる
- [ ] チェックで完了/解除でき、表示が即更新される
- [ ] 下部シートで編集し、閉じる/保存が適切に動作
- [ ] 破壊的操作に取り消し手段がある
- [ ] 空データ、長い日本語タイトル、40件以上のスクロールで崩れない
- [ ] VoiceOverラベル・フォーカス・タッチ領域を確認

## Phase 1C — カレンダー UI

### スコープ

- 月グリッド・今日/選択日・月移動
- 初期の1人状態は1列タイムライン、2人状態はA/B別タイムライン。2人状態ではA+B全幅の共有予定も表示
- 終日チップ、期限TODOの別一覧。終日予定がない日は終日欄を表示しない
- 予定の作成・編集・削除・Undo、localStorageへの仮保存。担当A/B/ふたり（`both`）に対応し、同じ担当の時間重複は最長予定と「他N件」一覧シートにまとめる
- 終日／開始・終了時間、カテゴリ・場所・メモの編集
- iPhone向け共通ボトムシートと月移動アニメーション

### DoD

- [x] 正しい曜日/日数で月表示できる（自動テストに閏日のケースを追加）
- [x] 日付選択で日別一覧が切り替わる
- [x] 予定と期限TODOを区別して表示
- [x] 前月/翌月、月末、2月29日の表示を実装
- [x] 320 / 375 / 390 / 430pxの自動テストを追加
- [ ] Safari・ホーム画面PWA実機で日付／時刻ピッカーとキーボードを確認（1E）

## Phase 1D — メモ機能（保留）

メモタブの位置は残し、画面には「メモ機能は開発中です」とだけ表示する。メモ一覧・詳細・作成・編集・永続化は保留。既存の `noca.notes.v1` がブラウザに残っていても、現バージョンでは読み書き・削除しない。

再開時は、買い物リストや旅行計画など具体的な利用シーンを確認し、TODO/予定内の補足欄と何が異なるかを決めてから要件を作る。

## Phase 1E — UIレビュー・iPhone実機表示テスト・デザイン凍結

### 作業順

1. デスクトップのブラウザDevToolsで375 / 390 / 430pxを確認
2. 実機iPhone Safariで通常表示のテスト
3. HTTPSのテスト環境でホーム画面へ追加し、standalone表示でテスト
4. TODO/カレンダーの通常状態と編集、メモの開発中案内、キーボード状態、ダークモードを確認
5. 発見した問題を修正→同一条件で再テスト
6. キャプチャと受け入れ結果を記録し、UIデザインを確定

### DoD — UI確定のゲート

- [ ] [UI_QA.md](UI_QA.md) の **Must** をすべて合格
- [ ] 重大な操作不能/データ消失に見えるUI/横スクロール/重なり: **0件**
- [ ] Safari / standalone それぞれ主要導線を最後まで操作できる
- [ ] TODO/カレンダー/メモ案内画面のライトモード・ダークモードのキャプチャ記録
- [ ] ユーザーによるUI承認（配色・情報量・3タブ構成・編集方法）
- [ ] README とデザイントークンを実装値で更新

## Phase 2 — 認証・共有スペース（実装中）

- Google Auth、workspace、最大2人のmembers
- 24時間有効の招待リンク、再発行時の旧リンク失効
- Firestore transactionとSecurity Rulesで参加処理を原子的に制限
- 設定にログイン／スペース作成／招待リンク導線を追加。招待URLからGoogleログイン後に参加できる
- Firebase環境変数がない場合は従来のローカルプレビューで動作する
- 既存localStorageデータは読み替え・移動しない。TODO/予定の共有同期はPhase 3
- Firebase Web app/Google Auth/Firestore/RulesとVercel Production/Preview設定は準備済み。アプリPreviewのデプロイと2アカウント受け入れ確認が残る。手順は [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- PWA / Safariでログイン挙動が異なる可能性を検証

**DoD:** 2人だけがworkspaceに参加でき、第三者はアクセス不可。招待が失効・重複使用・3人目参加を拒否する。Firebase接続とセキュリティケースの確認を記録する。

## Phase 3 — TODO・予定の共有データ連携（主要実装済み・受け入れ未完了）

- TODO・TODOカテゴリ・予定をworkspace別Firestoreコレクションへ保存。メモCRUDは保留。
- 設定で同期開始を選択：この端末の既存データを共有へ追加するか、端末内データを残して共有データから始める。
- カテゴリは正規化した名前、TODO・予定は元ID由来の安定IDで再試行と同一データ移行を重複防止。別々に作られた別IDの記録は別項目として保持。
- リアルタイム監視、workspace別の端末キャッシュ、永続オフラインキュー、再接続／手動再同期。
- リビジョン付きtransactionで同時編集を検知し、未解決競合では端末側か共有側を選択。削除はtombstoneで保持し、既存Undoから復元。
- レコード形式、workspaceメンバー、競合解決、端末移行マーカーを制限するRulesを追加。利用前にFirebaseへデプロイが必要。
- バックアップは現在選択中のデータを出力し、共有モード復元は同期キューを通し、元のlocalStorageデータを上書きしない。
- Firebase SDK/サービスは初回ダウンロードには含めず、オンライン利用時にランタイムキャッシュへ保存。認証UIDにひもづくメンバー情報キャッシュと共有データキューを使い、Firebaseコードの取得後にオフライン再起動を想定。

**Source acceptance checklist:**
- [x] Typecheck、本番ビルド、bundle予算を通過。
- [ ] 既存localStorageは共有読み書きで変化せず、ログアウト後に端末内データとして再表示。
- [ ] 途中失敗後の再試行と、同じ元IDを2端末から移行した場合の重複防止。別IDは別項目として保持。
- [ ] サインイン済みの2人がTODO・カテゴリ・予定の追加／編集／削除／Undoを両端末で確認。
- [ ] オフライン編集は再読み込み後も保留表示され、再接続時に共有へ送信。共有側の変更を無言で上書きしない。
- [ ] 競合解決が最新共有リビジョンを確認し、デプロイ済みRulesが非メンバーの読み書きを拒否。
- [ ] iPhone Safari/PWAでログアウト、移行、オフライン、復元を確認。
- [ ] E2E/PWAブラウザスイートをPhase 3のコードで実行。

Phase 2 remains in progress until the two-account invite and access-control checks are recorded. Phase 3 remains in progress until the revised Rules are deployed and the checklist is verified against a Firebase project and two devices.

## Phase 4 — PWA品質

- manifest/icons/theme-color/splash相当の表示整理
- Service Workerのアップデート/キャッシュ戦略
- オフライン読書き・再接続後の同期検証
- 通知は「必要性を再確認→採用する場合に実装」、許可取得と端末差異を検証
- HTTPSの本番公開先を判断（現行プレビューはVercel。Firebase Hostingは候補で未確定）

**DoD:** ホーム画面起動、更新、オンライン/オフラインが実用レベルで安定する。

## Phase 5 — リリース品質

- セキュリティルールテスト、アクセス権限・ログ見直し
- 本番データにダミーデータを混在させない
- リンク共有/アカウント入替/退会/データエクスポートの手順確認
- 依存パッケージ更新・実機回帰テスト・リリースノート

**DoD:** 本番用ドメインで双方が使え、重大問題なし。

## 作業チケット分割例

| チケット | 成果 |
| --- | --- |
| P1A-01 | Vite/React/shadcn UI初期化 |
| P1A-02 | デザイントークンと共通コンポーネント |
| P1A-03 | 下部3タブとiOS Safe Area |
| P1B-01 | TODO一覧・フィルター |
| P1B-02 | TODO追加編集シート |
| P1B-03 | 完了/削除/Undo・状態表示 |
| P1C-01 | 月間カレンダー |
| P1C-02 | 日別一覧・予定作成編集 |
| P1D（保留） | メモの用途整理後に、必要な場合のみ要件を再設定 |
| P1E-01 | Safari表示QA |
| P1E-02 | Home Screen PWA QA |
| P1E-03 | UI調整・承認 |

---
各Phaseの作業を終えたら本書のチェックを更新してから次に進む。
