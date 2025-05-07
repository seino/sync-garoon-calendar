# Sync Garoon Calendar

ガルーンのスケジュールを外部カレンダーサービスと同期するためのTypeScriptツールです。現在はGoogle Calendarとの同期に対応しています。将来的にはOutlookとの同期も実装予定です。

## 機能

- Garoonから Google Calendarへのスケジュール同期
- イベントの追加・更新・削除に対応
- Microsoft Teamsへの通知機能
- 重複登録防止機能
- TypeScriptによる型安全性

## 前提条件

- Node.js 14.0以上
- TypeScript 4.5以上
- Garoon APIアクセス権限
- Google Calendar APIアクセス用のサービスアカウント
- (任意) Microsoft TeamsのWebhook URL

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

3. 設定ファイルの作成:

```bash
cp config/config.example.json config/config.json
```

4. `config.json`を編集して必要な設定を行います。

5. Google Calendar APIの認証情報を配置:

サービスアカウントのJSONファイルを`credentials/`ディレクトリにコピーします。

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

#### サービスとして実行 (PM2を使用)

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
│   │   ├── config.ts           # 設定管理
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
├── config/                     # 設定ファイル
│   └── config.example.json     # 設定ファイル例
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
- **axios**: HTTP通信用
- **googleapis**: Google Calendar API用
- **ms-teams-webhook**: Microsoft Teams通知用
- **better-sqlite3**: データベース操作用
- **dotenv**: 環境変数管理用
- **node-cron**: 定期実行用
- **jest & ts-jest**: TypeScriptでのテスト用

### package.jsonの例

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

### tsconfig.jsonの例

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

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルをご覧ください。

## 謝辞

- [Cybozu Garoon API](https://developer.cybozu.io/hc/ja/articles/360000503586)
- [Google Calendar API](https://developers.google.com/calendar)
