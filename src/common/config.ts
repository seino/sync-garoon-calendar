// 設定管理
// 方針: 機密情報のみを.envファイルで管理し、その他はデフォルト値で管理

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { AppConfig } from '../types/config';
import { GaroonTarget } from '../types/garoon';

// .envファイルがあれば読み込む（機密情報専用）
dotenv.config();

/**
 * GAROON_TARGETS環境変数をパースする
 * 形式: "user:2,organization:4"
 * @param targetsStr ターゲット文字列
 * @returns パースされたターゲット配列
 */
function parseGaroonTargets(targetsStr: string): GaroonTarget[] {
  const targets: GaroonTarget[] = [];

  const parts = targetsStr.split(',').map((s) => s.trim());
  for (const part of parts) {
    const [type, id] = part.split(':').map((s) => s.trim());
    if (type && id && (type === 'user' || type === 'organization')) {
      targets.push({ type, id });
    } else {
      console.warn(`無効なターゲット形式をスキップしました: ${part}`);
    }
  }

  if (targets.length === 0) {
    throw new Error(
      `GAROON_TARGETSの形式が不正です: ${targetsStr}。正しい形式: user:2,organization:4`
    );
  }

  return targets;
}

/**
 * 設定を読み込む
 * 基本はデフォルト設定を使用し、機密情報のみ環境変数から読み込む
 * config.jsonファイルがある場合はそれも読み込む（.envが優先）
 * @param configPath 設定ファイルパス（オプション）
 * @returns 設定オブジェクト
 */
export function loadConfig(configPath?: string): AppConfig {
  try {
    // デフォルト設定を取得
    const config = getDefaultConfig();

    // 環境変数による上書き（機密情報のみ）
    // Garoon認証情報
    if (process.env.GAROON_API_TOKEN) {
      config.garoon.apiToken = process.env.GAROON_API_TOKEN;
    }

    if (process.env.GAROON_USERNAME) {
      config.garoon.username = process.env.GAROON_USERNAME;
    }

    if (process.env.GAROON_PASSWORD) {
      config.garoon.password = process.env.GAROON_PASSWORD;
    }

    // 複数ターゲット設定（新形式: GAROON_TARGETS=user:2,organization:4）
    if (process.env.GAROON_TARGETS) {
      config.garoon.targets = parseGaroonTargets(process.env.GAROON_TARGETS);
    } else {
      // 旧形式との後方互換性（GAROON_TARGET_TYPE + GAROON_TARGET_ID）
      if (process.env.GAROON_TARGET_TYPE) {
        config.garoon.targetType = process.env.GAROON_TARGET_TYPE as
          | 'user'
          | 'organization';
      }

      if (process.env.GAROON_TARGET_ID) {
        config.garoon.targetId = process.env.GAROON_TARGET_ID;
      }
    }

    // Google認証情報
    if (process.env.GOOGLE_CREDENTIALS_PATH) {
      config.google.credentials = process.env.GOOGLE_CREDENTIALS_PATH;
    }

    if (process.env.GOOGLE_CALENDAR_ID) {
      config.google.calendarId = process.env.GOOGLE_CALENDAR_ID;
    }

    // Google OAuth認証情報（将来の拡張のため）
    if (process.env.GOOGLE_CLIENT_ID) {
      if (!config.google.oauth) {
        config.google.oauth = { clientId: '', clientSecret: '' };
      }
      config.google.oauth.clientId = process.env.GOOGLE_CLIENT_ID;
    }

    if (process.env.GOOGLE_CLIENT_SECRET) {
      if (!config.google.oauth) {
        config.google.oauth = { clientId: '', clientSecret: '' };
      }
      config.google.oauth.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    }

    // Teams認証情報
    if (process.env.TEAMS_WEBHOOK_URL) {
      config.teams.webhookUrl = process.env.TEAMS_WEBHOOK_URL;
    }

    // 古いconfigファイルがある場合は読み込み（後方互換性のため）
    if (configPath) {
      try {
        const absolutePath = path.resolve(process.cwd(), configPath);
        if (fs.existsSync(absolutePath)) {
          const configData = fs.readFileSync(absolutePath, 'utf8');
          const fileConfig: AppConfig = JSON.parse(configData);

          // JSONファイルの設定で上書き
          // 基本設定
          if (fileConfig.garoon?.baseUrl)
            config.garoon.baseUrl = fileConfig.garoon.baseUrl;

          // 機密情報は.envが優先されるが、設定がなければJSONから読み込む
          if (!config.garoon.apiToken && fileConfig.garoon?.apiToken) {
            config.garoon.apiToken = fileConfig.garoon.apiToken;
          }
          if (!config.garoon.username && fileConfig.garoon?.username) {
            config.garoon.username = fileConfig.garoon.username;
          }
          if (!config.garoon.password && fileConfig.garoon?.password) {
            config.garoon.password = fileConfig.garoon.password;
          }

          // その他の設定
          if (fileConfig.google?.calendarId)
            config.google.calendarId = fileConfig.google.calendarId;
          if (!config.google.credentials && fileConfig.google?.credentials) {
            config.google.credentials = fileConfig.google.credentials;
          }

          if (fileConfig.sync) {
            if (typeof fileConfig.sync.days === 'number')
              config.sync.days = fileConfig.sync.days;
            if (typeof fileConfig.sync.excludePrivate === 'boolean')
              config.sync.excludePrivate = fileConfig.sync.excludePrivate;
            if (typeof fileConfig.sync.intervalMinutes === 'number')
              config.sync.intervalMinutes = fileConfig.sync.intervalMinutes;
          }

          if (!config.teams.webhookUrl && fileConfig.teams?.webhookUrl) {
            config.teams.webhookUrl = fileConfig.teams.webhookUrl;
          }
          if (typeof fileConfig.teams?.notifyOnError === 'boolean') {
            config.teams.notifyOnError = fileConfig.teams.notifyOnError;
          }

          if (fileConfig.database?.path)
            config.database.path = fileConfig.database.path;
        }
      } catch (error) {
        console.warn(
          `設定ファイルの読み込みに失敗しましたが、デフォルト値と環境変数で続行します: ${error}`
        );
      }
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`設定の読み込みに失敗しました: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 設定の有効性を検証する
 * @param config 検証する設定オブジェクト
 * @throws 設定が無効な場合はエラーをスロー
 */
export function validateConfig(config: AppConfig): void {
  // Garoon設定の検証
  if (!config.garoon.baseUrl) {
    throw new Error(
      'GaroonのベースURLが設定されていません。GAROON_BASE_URLを設定してください'
    );
  }

  if (
    !config.garoon.apiToken &&
    (!config.garoon.username || !config.garoon.password)
  ) {
    throw new Error(
      'GaroonのAPIトークンまたはユーザー名とパスワードが設定されていません。GAROON_API_TOKENまたはGAROON_USERNAMEとGAROON_PASSWORDを設定してください'
    );
  }

  // Google Calendar設定の検証
  if (!config.google.calendarId) {
    throw new Error(
      'GoogleカレンダーIDが設定されていません。GOOGLE_CALENDAR_IDを設定してください'
    );
  }

  if (!config.google.credentials) {
    throw new Error(
      'Google認証情報のパスが設定されていません。GOOGLE_CREDENTIALS_PATHを設定してください'
    );
  }

  const credentialsPath = path.resolve(
    process.cwd(),
    config.google.credentials
  );
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Google認証情報ファイルが見つかりません: ${credentialsPath}`
    );
  }

  // テスト用に最小限の設定を許容する
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // その他の設定の検証
  if (!config.sync || typeof config.sync.days !== 'number') {
    throw new Error(
      '同期日数が設定されていません。SYNC_DAYSを設定してください'
    );
  }
}

/**
 * デフォルト設定を取得
 */
export function getDefaultConfig(): AppConfig {
  return {
    garoon: {
      // 必須項目だが、サービスによって異なるため環境変数またはconfig.jsonで設定
      baseUrl: process.env.GAROON_BASE_URL || 'https://your-company.cybozu.com',
      apiToken: '', // 機密情報のため.envで設定
      username: '', // 機密情報のため.envで設定
      password: '', // 機密情報のため.envで設定
      targetType: 'user', // デフォルトはユーザー指定
      targetId: '2', // デフォルトはユーザーID=2
    },
    google: {
      calendarId: 'primary',
      credentials: 'credentials/google-service-account.json', // デフォルト値、.envで上書き可能
      oauth: {
        clientId: '', // 機密情報のため.envで設定
        clientSecret: '', // 機密情報のため.envで設定
      },
    },
    sync: {
      days: 30,
      excludePrivate: true,
      intervalMinutes: 15,
      defaultTimeZone: process.env.DEFAULT_TIMEZONE || 'Asia/Tokyo',
    },
    teams: {
      webhookUrl: '', // 機密情報のため.envで設定
      notifyOnError: true,
    },
    database: {
      path: './data/sync.db',
    },
  };
}
