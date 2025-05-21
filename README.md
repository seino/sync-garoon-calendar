# Sync Garoon Calendar

ガルーンのスケジュールを外部カレンダーサービスと同期するための TypeScript ツールです。現在は Google Calendar との同期に対応しています。将来的には Outlook との同期も実装予定です。

## 機能

- Garoon から Google Calendar へのスケジュール同期
- イベントの追加・更新・削除に対応
- Microsoft Teams への通知機能
- 重複登録防止機能
- TypeScript による型安全性

## 前提条件

- Node.js 14.0 以上
- TypeScript 4.5 以上
- Garoon API アクセス権限
- Google Calendar API アクセス用のサービスアカウント
- (任意) Microsoft Teams の Webhook URL

## インストール方法

1. リポジトリのクローン:

```bash
git clone https://github.com/seino/sync-garoon-calendar.git
cd sync-garoon-calendar
```

2. 依存パッケージのインストール:

```bash
npm install
```

3. 環境変数の設定:

```bash
cp .env.example .env
```

4. `.env`ファイルを編集して必要な設定を行います。

5. Google Calendar API の認証情報を配置:

サービスアカウントの JSON ファイルを`credentials/`ディレクトリにコピーします。

## 使い方

### アプリケーションのビルド

```bash
# TypeScriptコードをコンパイル
npm run build
```

### 基本的な使用方法

```bash
# Google Calendarとの同期を実行
npm start
# または
node dist/scripts/syncGoogle.js
```

### 開発モード

```bash
# ソース変更を監視して自動再起動
npm run dev
```

### ユーティリティスクリプト

このプロジェクトには以下のユーティリティスクリプトが含まれています。

#### Google Calendar のテスト

```bash
# Google Calendarへの操作（作成・更新・削除）をテストします
npx ts-node src/scripts/test-calendar.ts
```

#### Google 認証トークンの取得

```bash
# OAuth2.0認証トークンを取得します
npx ts-node src/scripts/get-google-token.ts
```

#### カレンダー一覧の取得

```bash
# アクセス可能なGoogleカレンダーの一覧を取得します
npx ts-node src/scripts/list-calendars.ts
```

## 設定方法

このアプリケーションは環境変数による設定をサポートしています。`.env`ファイルを作成して設定値を指定します。

### 設定の考え方

このプロジェクトでは、**機密情報のみを環境変数**で管理し、その他の設定はコード内のデフォルト値で管理します。

### 環境変数で管理する設定（機密情報）

```bash
# Garoon認証情報（APIトークンまたはユーザー名/パスワードのいずれかが必要）
GAROON_API_TOKEN=                       # 機密情報
# または
GAROON_USERNAME=                        # 機密情報
GAROON_PASSWORD=                        # 機密情報

# Google認証情報
GOOGLE_CREDENTIALS_PATH=                # サービスアカウント認証情報ファイルのパス（メイン同期処理に使用）
GOOGLE_CALENDAR_ID=                     # 同期先のカレンダーID
GOOGLE_CLIENT_ID=                       # OAuth2.0クライアントID（スクリプト用、Google APIコンソールから取得）
GOOGLE_CLIENT_SECRET=                   # OAuth2.0クライアントシークレット（スクリプト用）

# Teams通知設定（省略可）
TEAMS_WEBHOOK_URL=                      # 機密情報
```

### コード内のデフォルト値で管理する設定

以下の設定は `src/common/config.ts` 内のデフォルト値として管理されています。
変更する必要がある場合は、ソースコードを修正するか、`config.json` ファイルを作成して上書きします。

```javascript
// デフォルト値の例
{
  garoon: {
    baseUrl: 'https://your-company.cybozu.com',  // Garoonのベースドメイン
  },
  google: {
    calendarId: 'primary',  // 同期先のカレンダーID
  },
  sync: {
    days: 30,              // 何日分の予定を同期するか
    excludePrivate: true,  // プライベート予定を除外するかどうか
    intervalMinutes: 15,   // 定期実行間隔（分）
  },
  teams: {
    notifyOnError: true,   // エラー発生時に通知するかどうか
  },
  database: {
    path: './data/sync.db', // データベースファイルパス
  }
}
```

### Google 認証情報について

このプロジェクトでは 2 種類の認証方式をサポートしています。

1. **サービスアカウント認証**（メインの同期処理用）

   - `GOOGLE_CREDENTIALS_PATH`で指定された JSON ファイルを使用
   - バックグラウンド処理や定期実行に適している

2. **OAuth2.0 クライアント認証**（補助スクリプト用）
   - `GOOGLE_CLIENT_ID`と`GOOGLE_CLIENT_SECRET`を使用
   - `src/scripts/get-google-token.ts`などのユーティリティツールで使用
   - ユーザー許可が必要な処理に使用

### 後方互換性

旧バージョンとの互換性のため、従来の`config.json`による設定も引き続きサポートされていますが、新しいプロジェクトでは機密情報のみを環境変数で管理し、その他の設定はコード内のデフォルト値を使用することを推奨します。

### 定期実行の設定

このプロジェクトには`node-cron`が含まれており、アプリケーション内で定期実行を設定できます。

```typescript
// src/scripts/schedule.ts
import cron from 'node-cron';
import { syncEvents } from '../google/sync';

// 15分ごとに実行
cron.schedule('*/15 * * * *', () => {
  console.log('同期ジョブを実行中...');
  syncEvents().catch(console.error);
});

console.log('スケジューラーが起動しました。Ctrl+Cで終了できます。');
```

コンパイル後の実行:

```bash
node dist/scripts/schedule.js
```

#### サービスとして実行 (PM2 を使用)

```bash
# PM2のインストール
npm install -g pm2

# サービスとして起動
pm2 start dist/scripts/schedule.js --name "garoon-sync"

# 起動時に自動実行
pm2 startup
pm2 save
```

## 開発者向け情報

### プロジェクト構造

```
sync-garoon-calendar/
├── src/                        # TypeScriptソースコード
│   ├── common/                 # 共通コード
│   │   ├── config.ts           # 設定管理（環境変数対応）
│   │   ├── database.ts         # データベース操作
│   │   ├── garoon.ts           # Garoon API操作
│   │   └── notification.ts     # 通知機能
│   │
│   ├── google/                 # Google Calendar連携
│   │   ├── calendar.ts         # GCal API操作
│   │   └── sync.ts             # 同期ロジック
│   │
│   ├── outlook/                # (将来) Outlook連携
│   │   └── README.md           # 将来実装の説明
│   │
│   ├── scripts/                # 実行スクリプト
│   │   ├── syncGoogle.ts       # Googleカレンダー同期実行
│   │   └── schedule.ts         # 定期実行スクリプト
│   │
│   └── types/                  # 型定義
│       ├── garoon.ts           # Garoon関連の型
│       ├── google.ts           # Google Calendar関連の型
│       └── config.ts           # 設定関連の型
│
├── dist/                       # コンパイル後のJavaScriptコード
│
├── .env.example                # 環境変数設定例
│
├── credentials/                # 認証情報
│   └── README.md               # 認証情報の説明
│
├── tests/                      # テストコード
│   ├── garoon.test.ts          # Garoonクライアントのテスト
│   └── google.test.ts          # GoogleCalendarクライアントのテスト
│
├── .gitignore                  # Git除外設定
├── tsconfig.json               # TypeScript設定
├── jest.config.js              # Jest設定
├── LICENSE                     # MITライセンス
├── README.md                   # プロジェクト説明
├── package.json                # パッケージ設定
└── package-lock.json           # 依存関係ロックファイル
```

### 型定義の例

```typescript
// src/types/garoon.ts
export interface GaroonEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay: boolean;
  notes?: string;
  attendees: GaroonAttendee[];
  visibilityType: string;
  // 他の必要なプロパティ
}

export interface GaroonAttendee {
  id: string;
  type: 'USER' | 'ORGANIZATION' | 'FACILITY';
  name: string;
}
```

### テストの実行

```bash
npm test
```

### 使用している主なパッケージ

- **typescript**: 静的型付け
- **axios**: HTTP 通信用
- **googleapis**: Google Calendar API 用
- **ms-teams-webhook**: Microsoft Teams 通知用
- **better-sqlite3**: データベース操作用
- **dotenv**: 環境変数管理用
- **node-cron**: 定期実行用
- **jest & ts-jest**: TypeScript でのテスト用

### package.json の例

```json
{
  "name": "sync-garoon-calendar",
  "version": "1.0.0",
  "description": "ガルーンのスケジュールを外部カレンダーサービスと同期",
  "main": "dist/scripts/syncGoogle.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/scripts/syncGoogle.js",
    "dev": "ts-node-dev --respawn src/scripts/syncGoogle.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "better-sqlite3": "^8.6.0",
    "dotenv": "^16.3.1",
    "googleapis": "^128.0.0",
    "ms-teams-webhook": "^2.0.2",
    "node-cron": "^3.0.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.4",
    "@types/node-cron": "^3.0.11",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2",
    "eslint": "^8.55.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.1",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.3"
  }
}
```

### tsconfig.json の例

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "tests", "dist"]
}
```

## 謝辞

- [Cybozu Garoon API](https://developer.cybozu.io/hc/ja/articles/360000503586)
- [Google Calendar API](https://developers.google.com/calendar)
