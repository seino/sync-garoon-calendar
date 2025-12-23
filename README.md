# Sync Garoon Calendar

ガルーンのスケジュールをGoogle Calendarに同期するツールです。

## 機能

- Garoon → Google Calendar への一方向同期
- イベントの追加・更新・削除に対応
- 指数バックオフによるAPIリトライ処理
- Microsoft Teams への通知機能（オプション）

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
GAROON_BASE_URL=https://your-company.cybozu.com/g/
GAROON_USERNAME=your-username
GAROON_PASSWORD=your-password
GAROON_TARGET_TYPE=user
GAROON_TARGET_ID=2

# Google設定
GOOGLE_CREDENTIALS_PATH=credentials/google-service-account.json
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Teams通知（オプション）
TEAMS_WEBHOOK_URL=
```

## 使い方

```bash
# 同期実行
npm start

# 開発モード
npm run dev
```

## 定期実行（Ubuntu）

```bash
# cronで15分ごとに実行
crontab -e
*/15 * * * * cd /path/to/sync-garoon-calendar && /usr/bin/node dist/scripts/syncGoogle.js >> /var/log/garoon-sync.log 2>&1
```
