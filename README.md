# Sync Garoon Calendar

ガルーンのスケジュールを Google Calendar に同期するための TypeScript ツールです。

## 機能

- Garoon から Google Calendar へのスケジュール同期
- イベントの追加・更新に対応
- 複数ターゲット対応（ユーザー・組織を並列取得）
- 終日イベント・イベントメニュー接頭辞に対応
- 指数バックオフによるAPIリトライ処理
- Microsoft Teams への通知機能
- 重複登録防止機能（extendedProperties による照合）
- TypeScript による型安全性

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# ビルド
npm run build

# 環境変数の設定
cp .env.example .env
# .envファイルを編集

# Google認証情報を配置
# サービスアカウントのJSONを credentials/ にコピー
```

## 環境変数

```bash
# Garoon設定
GAROON_BASE_URL=https://your-company.cybozu.com
GAROON_USERNAME=your-username
GAROON_PASSWORD=your-password
GAROON_TARGET_TYPE=user
GAROON_TARGET_ID=2
# 複数ターゲット（上記の代わりに使用可能）
# GAROON_TARGETS=user:2,organization:4

# Google設定
GOOGLE_CREDENTIALS_PATH=credentials/google-service-account.json
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Teams通知（オプション）
TEAMS_WEBHOOK_URL=
```

## 使い方

### 同期実行

```bash
# 本番同期（7日間、デフォルト）
npm start

# ドライランモード（実際には同期しない）
npm run sync:dry-run

# 期間指定の同期
npm run sync:7days      # 7日間
npm run sync:30days     # 30日間

# 任意の日数指定
npm run sync -- --days=14
```

### テスト・デバッグ

```bash
# 詳細デバッグ付き同期テスト
npm run test:sync

# テストのみ（実際の同期は行わない）
npm run test:sync -- --test-only

# Garoon API接続テスト
npm run test:garoon

# Garoon API接続テスト（組織ID指定）
npm run test:garoon:org
```

### 定期実行

```bash
# スケジューラー起動（設定ファイルの間隔で自動実行）
npm run schedule
```

### 開発モード

```bash
npm run dev
```

## 開発者向け情報

### プロジェクト構造

```
sync-garoon-calendar/
├── src/
│   ├── common/                 # 共通コード
│   │   ├── config.ts           # 設定管理（環境変数対応）
│   │   ├── garoon.ts           # Garoon API操作
│   │   ├── retry.ts            # 指数バックオフリトライ
│   │   └── notification.ts     # Teams通知機能
│   │
│   ├── google/                 # Google Calendar連携
│   │   ├── calendar.ts         # GCal API操作
│   │   └── sync.ts             # 同期ロジック（共通処理）
│   │
│   ├── scripts/                # 実行スクリプト
│   │   ├── sync-google.ts      # 本番用同期
│   │   ├── test-sync-google.ts # テスト用同期（デバッグ表示付き）
│   │   ├── schedule.ts         # 定期実行スケジューラー
│   │   ├── test-garoon.ts      # Garoon API接続テスト
│   │   └── clean-google-events.ts  # イベント一括削除
│   │
│   └── types/                  # 型定義
│       ├── garoon.ts           # Garoon関連の型
│       ├── google.ts           # Google Calendar関連の型
│       ├── calendar.ts         # 共通カレンダーイベント型
│       └── config.ts           # 設定関連の型
│
├── tests/                      # テストコード
│   ├── garoon.test.ts
│   ├── google.test.ts
│   └── sync.test.ts
│
├── credentials/                # 認証情報（.gitignore対象）
├── .env.example                # 環境変数設定例
├── .eslintrc.json              # ESLint設定
├── tsconfig.json               # TypeScript設定
├── jest.config.js              # Jest設定
└── package.json
```

### テストの実行

```bash
npm test
```

## ライセンス

MIT ライセンス。詳細は[LICENSE](LICENSE)ファイルをご覧ください。
