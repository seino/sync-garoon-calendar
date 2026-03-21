import { loadConfig, validateConfig, getDefaultConfig } from '../src/common/config';

// fs をモック
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn(),
}));

import fs from 'fs';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // テスト用にクリーンな環境変数
    delete process.env.GAROON_API_TOKEN;
    delete process.env.GAROON_USERNAME;
    delete process.env.GAROON_PASSWORD;
    delete process.env.GAROON_BASE_URL;
    delete process.env.GAROON_TARGETS;
    delete process.env.GAROON_TARGET_TYPE;
    delete process.env.GAROON_TARGET_ID;
    delete process.env.GOOGLE_CREDENTIALS_PATH;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.TEAMS_WEBHOOK_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getDefaultConfig', () => {
    it('デフォルト設定を返す', () => {
      const config = getDefaultConfig();

      expect(config.garoon.targetType).toBe('user');
      expect(config.garoon.targetId).toBe('2');
      expect(config.google.calendarId).toBe('primary');
      expect(config.sync.days).toBe(30);
      expect(config.sync.excludePrivate).toBe(true);
      expect(config.teams.notifyOnError).toBe(true);
    });
  });

  describe('loadConfig', () => {
    it('環境変数でGaroon認証情報を上書きする', () => {
      process.env.GAROON_API_TOKEN = 'test-token';
      const config = loadConfig();

      expect(config.garoon.apiToken).toBe('test-token');
    });

    it('環境変数でGoogle設定を上書きする', () => {
      process.env.GOOGLE_CALENDAR_ID = 'custom@group.calendar.google.com';
      process.env.GOOGLE_CREDENTIALS_PATH = 'custom/creds.json';
      const config = loadConfig();

      expect(config.google.calendarId).toBe('custom@group.calendar.google.com');
      expect(config.google.credentials).toBe('custom/creds.json');
    });

    it('環境変数でTeams webhook URLを上書きする', () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://teams.webhook.url';
      const config = loadConfig();

      expect(config.teams.webhookUrl).toBe('https://teams.webhook.url');
    });

    it('GAROON_TARGETS環境変数で複数ターゲットを設定する', () => {
      process.env.GAROON_TARGETS = 'user:2,organization:4';
      const config = loadConfig();

      expect(config.garoon.targets).toEqual([
        { type: 'user', id: '2' },
        { type: 'organization', id: '4' },
      ]);
    });

    it('GAROON_TARGETSが不正な形式の場合エラーをスローする', () => {
      process.env.GAROON_TARGETS = 'invalid';
      expect(() => loadConfig()).toThrow('設定の読み込みに失敗しました');
    });

    it('旧形式のGAROON_TARGET_TYPE/IDも動作する', () => {
      process.env.GAROON_TARGET_TYPE = 'organization';
      process.env.GAROON_TARGET_ID = '10';
      const config = loadConfig();

      expect(config.garoon.targetType).toBe('organization');
      expect(config.garoon.targetId).toBe('10');
    });

    it('configPathを指定するとJSONファイルから設定を上書きする', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          garoon: { baseUrl: 'https://custom.cybozu.com' },
          sync: { days: 14 },
        })
      );

      const config = loadConfig('config/custom.json');

      expect(config.garoon.baseUrl).toBe('https://custom.cybozu.com');
      expect(config.sync.days).toBe(14);
    });

    it('設定ファイルが存在しない場合はデフォルト値で続行する', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = loadConfig('nonexistent.json');
      expect(config.sync.days).toBe(30);
    });

    it('環境変数が設定ファイルより優先される（機密情報）', () => {
      process.env.GAROON_API_TOKEN = 'env-token';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          garoon: { apiToken: 'file-token' },
        })
      );

      const config = loadConfig('config.json');

      expect(config.garoon.apiToken).toBe('env-token');
    });
  });

  describe('validateConfig', () => {
    it('正常な設定では例外をスローしない', () => {
      process.env.NODE_ENV = 'test';
      const config = getDefaultConfig();
      config.garoon.baseUrl = 'https://example.cybozu.com';
      config.garoon.apiToken = 'token';
      config.google.calendarId = 'cal@google.com';
      config.google.credentials = 'creds.json';

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('baseUrlが空の場合エラーをスローする', () => {
      const config = getDefaultConfig();
      config.garoon.baseUrl = '';
      config.garoon.apiToken = 'token';

      expect(() => validateConfig(config)).toThrow('ベースURL');
    });

    it('認証情報が未設定の場合エラーをスローする', () => {
      const config = getDefaultConfig();
      config.garoon.apiToken = '';
      config.garoon.username = '';
      config.garoon.password = '';

      expect(() => validateConfig(config)).toThrow('APIトークンまたはユーザー名');
    });

    it('GoogleカレンダーIDが未設定の場合エラーをスローする', () => {
      const config = getDefaultConfig();
      config.garoon.apiToken = 'token';
      config.google.calendarId = '';

      expect(() => validateConfig(config)).toThrow('カレンダーID');
    });

    it('Google認証情報パスが未設定の場合エラーをスローする', () => {
      const config = getDefaultConfig();
      config.garoon.apiToken = 'token';
      config.google.credentials = '';

      expect(() => validateConfig(config)).toThrow('認証情報のパス');
    });

    it('Google認証情報ファイルが存在しない場合エラーをスローする', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const config = getDefaultConfig();
      config.garoon.apiToken = 'token';

      expect(() => validateConfig(config)).toThrow('認証情報ファイルが見つかりません');
    });
  });
});
