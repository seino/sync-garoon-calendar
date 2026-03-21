# Sync Garoon Calendar

ガルーンのスケジュールを Google Calendar に同期するための TypeScript ツールです。

## 機能

- Garoon から Google Calendar へのスケジュール一方向同期（作成・更新・削除）
- 複数ターゲット対応（ユーザー・組織を並列取得）
- 終日イベント・イベントメニュー接頭辞に対応
- Garoon から削除されたイベントの自動削除
- 指数バックオフによる API リトライ処理
- Microsoft Teams への同期結果通知（axios）
- 重複登録防止機能（extendedProperties による照合）
- 構造化 JSON ロガー（ligelog）
- cron による定期同期（デフォルト15分間隔）
- ドライランモード

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集

# Google認証情報を配置
# サービスアカウントのJSONを credentials/ にコピー
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `GAROON_API_TOKEN` | ガルーン API トークン（パスワード認証と排他） |
| `GAROON_USERNAME` / `GAROON_PASSWORD` | パスワード認証（API トークンと排他） |
| `GAROON_TARGETS` | 同期対象（例: `user:2,organization:4`） |
| `GOOGLE_CREDENTIALS_PATH` | サービスアカウント認証情報 JSON のパス |
| `GOOGLE_CALENDAR_ID` | 同期先の Google Calendar ID |
| `TEAMS_WEBHOOK_URL` | Teams 通知用 Webhook URL（任意） |
| `LOG_LEVEL` | ログレベル: `debug` / `info` / `warn` / `error`（デフォルト: `info`） |

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

### 定期実行

```bash
npm run schedule
```

### 接続テスト

```bash
# Garoon API 接続テスト
npm run test:garoon

# 組織 ID での接続テスト
npm run test:garoon:org
```

### 開発モード

```bash
npm run dev
```

## 開発

```bash
# ビルド
npm run build

# テスト
npm test

# lint
npm run lint
```

## プロジェクト構造

```
src/
├── common/              # 共通モジュール
│   ├── config.ts        # 設定管理（環境変数 + デフォルト値）
│   ├── garoon.ts        # Garoon API クライアント
│   ├── logger.ts        # 構造化ロガー（ligelog）
│   ├── notification.ts  # Teams 通知（axios）
│   └── retry.ts         # 指数バックオフ リトライ
├── google/              # Google Calendar 連携
│   ├── calendar.ts      # Google Calendar API クライアント
│   └── sync.ts          # 同期ロジック
├── scripts/             # 実行スクリプト
│   ├── sync-google.ts   # 本番同期
│   ├── schedule.ts      # 定期同期スケジューラー
│   └── ...              # 各種テスト・ユーティリティ
└── types/               # 型定義
    ├── garoon.ts
    ├── google.ts
    └── config.ts

tests/                   # Jest テスト
├── garoon.test.ts
├── google.test.ts
├── sync.test.ts
├── config.test.ts
└── notification.test.ts
```

## ライセンス

[MIT](LICENSE)
