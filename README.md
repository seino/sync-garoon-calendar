# Sync Garoon Calendar

ガルーンのスケジュールをGoogle Calendarに同期するTypeScriptツールです。

## 機能

- Garoon から Google Calendar への一方向同期
- イベントの追加・更新・削除に対応
- 削除されたイベントの自動検出と同期
- 指数バックオフによるAPIリトライ処理
- バッチ処理による効率的な同期
- Microsoft Teams への通知機能（オプション）
- SQLiteによる同期状態の永続化

## 前提条件

- Node.js 18.0 以上
- Garoon API アクセス権限
- Google Calendar API 用のサービスアカウント

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して認証情報を設定

# Google認証情報を配置
# サービスアカウントのJSONファイルを credentials/ にコピー
```

## 環境変数

```bash
# Garoon認証（APIトークンまたはユーザー名/パスワード）
GAROON_API_TOKEN=
# または
GAROON_USERNAME=
GAROON_PASSWORD=

# Garoonターゲット設定
GAROON_TARGET_TYPE=user        # 'user' または 'organization'
GAROON_TARGET_ID=2             # ユーザーIDまたは組織ID

# Google認証
GOOGLE_CREDENTIALS_PATH=       # サービスアカウントJSONのパス
GOOGLE_CALENDAR_ID=            # 同期先カレンダーID

# Teams通知（オプション）
TEAMS_WEBHOOK_URL=
```

## 使い方

```bash
# ビルド
npm run build

# 同期実行
npm start

# 開発モード（ホットリロード）
npm run dev

# テスト実行
npm test
```

## スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run test:garoon` | Garoon API接続テスト |
| `npm run test:garoon:org` | 組織ID指定でのGaroon APIテスト |
| `npx ts-node src/scripts/test-calendar.ts` | Google Calendar操作テスト |
| `npx ts-node src/scripts/list-calendars.ts` | カレンダー一覧取得 |

## 定期実行

```bash
# PM2でサービスとして実行
npm install -g pm2
pm2 start dist/scripts/schedule.js --name "garoon-sync"
pm2 startup && pm2 save
```

## プロジェクト構造

```
src/
├── common/           # 共通モジュール
│   ├── config.ts     # 設定管理
│   ├── database.ts   # SQLite操作
│   ├── garoon.ts     # Garoon APIクライアント
│   ├── retry.ts      # リトライ処理
│   └── notification.ts
├── google/           # Google Calendar連携
│   ├── calendar.ts   # GCal APIクライアント
│   └── sync.ts       # 同期ロジック
├── scripts/          # 実行スクリプト
└── types/            # 型定義
```

## 謝辞

- [Cybozu Garoon API](https://cybozu.dev/ja/garoon/docs/rest-api/)
- [Google Calendar API](https://developers.google.com/calendar)
