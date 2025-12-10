import { GaroonClient } from '../src/common/garoon';
import { GaroonAuthConfig } from '../src/types/garoon';

describe('GaroonClient', () => {
  describe('constructor', () => {
    it('throws error when baseUrl is not set', () => {
      const config: GaroonAuthConfig = {
        baseUrl: '',
        apiToken: 'test-token',
      };

      expect(() => new GaroonClient(config)).toThrow(
        'ガルーンのベースURLが設定されていません'
      );
    });

    it('throws error when baseUrl is invalid', () => {
      const config: GaroonAuthConfig = {
        baseUrl: 'invalid-url',
        apiToken: 'test-token',
      };

      expect(() => new GaroonClient(config)).toThrow(
        'ガルーンのベースURLが不正です'
      );
    });

    it('throws error when auth credentials are not set', () => {
      const config: GaroonAuthConfig = {
        baseUrl: 'https://example.cybozu.com',
      };

      expect(() => new GaroonClient(config)).toThrow(
        '認証情報が設定されていません'
      );
    });

    it('initializes successfully with apiToken', () => {
      const config: GaroonAuthConfig = {
        baseUrl: 'https://example.cybozu.com',
        apiToken: 'test-token',
      };

      expect(() => new GaroonClient(config)).not.toThrow();
    });

    it('initializes successfully with username and password', () => {
      const config: GaroonAuthConfig = {
        baseUrl: 'https://example.cybozu.com',
        username: 'test-user',
        password: 'test-password',
      };

      expect(() => new GaroonClient(config)).not.toThrow();
    });
  });

  describe('getSchedule', () => {
    it('throws error for invalid date format', async () => {
      const config: GaroonAuthConfig = {
        baseUrl: 'https://example.cybozu.com',
        apiToken: 'test-token',
      };

      const client = new GaroonClient(config);

      await expect(
        client.getSchedule('2024/01/01', '2024-01-31')
      ).rejects.toThrow('日付フォーマットが不正です');

      await expect(
        client.getSchedule('2024-01-01', '20240131')
      ).rejects.toThrow('日付フォーマットが不正です');
    });
  });
});
