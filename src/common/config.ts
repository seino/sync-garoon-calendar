// 設定管理

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { AppConfig } from '../types/config';

// .envファイルがあれば読み込む
dotenv.config();

/**
 * 設定ファイルを読み込む
 * @param configPath 設定ファイルのパス（デフォルトは config/config.json）
 * @returns 設定オブジェクト
 */
export function loadConfig(
  configPath: string = 'config/config.json'
): AppConfig {
  try {
    // 絶対パスに変換
    const absolutePath = path.resolve(process.cwd(), configPath);

    // ファイルの存在確認
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`設定ファイルが見つかりません: ${absolutePath}`);
    }

    // ファイル読み込み
    const configData = fs.readFileSync(absolutePath, 'utf8');
    const config: AppConfig = JSON.parse(configData);

    // 環境変数による上書き
    if (process.env.GAROON_API_TOKEN) {
      config.garoon.apiToken = process.env.GAROON_API_TOKEN;
    }

    if (process.env.GAROON_USERNAME) {
      config.garoon.username = process.env.GAROON_USERNAME;
    }

    if (process.env.GAROON_PASSWORD) {
      config.garoon.password = process.env.GAROON_PASSWORD;
    }

    if (process.env.GOOGLE_CALENDAR_ID) {
      config.google.calendarId = process.env.GOOGLE_CALENDAR_ID;
    }

    if (process.env.TEAMS_WEBHOOK_URL) {
      config.teams.webhookUrl = process.env.TEAMS_WEBHOOK_URL;
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
    throw new Error('GaroonのベースURLが設定されていません');
  }

  if (
    !config.garoon.apiToken &&
    (!config.garoon.username || !config.garoon.password)
  ) {
    throw new Error(
      'GaroonのAPIトークンまたはユーザー名とパスワードが設定されていません'
    );
  }

  // Google Calendar設定の検証
  if (!config.google.calendarId) {
    throw new Error('GoogleカレンダーIDが設定されていません');
  }

  if (!config.google.credentials) {
    throw new Error('Google認証情報のパスが設定されていません');
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
    throw new Error('同期日数が設定されていません');
  }
}

/**
 * デフォルト設定を取得
 */
export function getDefaultConfig(): AppConfig {
  return {
    garoon: {
      baseUrl: '',
      apiToken: '',
      username: '',
      password: '',
    },
    google: {
      calendarId: 'primary',
      credentials: 'credentials/google-service-account.json',
    },
    sync: {
      days: 30,
      excludePrivate: true,
      intervalMinutes: 15,
    },
    teams: {
      webhookUrl: '',
      notifyOnError: true,
    },
    database: {
      path: './data/sync.db',
    },
  };
}
