// Garoon API操作

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  GaroonAuthConfig,
  GaroonEvent,
  GaroonScheduleResponse,
} from '../types/garoon';

export class GaroonClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private authConfig: GaroonAuthConfig;

  constructor(config: GaroonAuthConfig) {
    this.authConfig = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 末尾のスラッシュを削除

    // Axiosインスタンスの作成
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10秒のタイムアウト
    });

    // 認証の設定
    this.setupAuth();
  }

  /**
   * 認証設定を行う
   */
  private setupAuth(): void {
    const { apiToken, username, password } = this.authConfig;

    if (apiToken) {
      // APIトークン認証
      this.client.defaults.headers.common['X-Cybozu-API-Token'] = apiToken;
    } else if (username && password) {
      // Basic認証
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      this.client.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    } else {
      throw new Error('認証情報が設定されていません');
    }
  }

  /**
   * 指定期間のスケジュールを取得
   * @param startDate 開始日 (YYYY-MM-DD)
   * @param endDate 終了日 (YYYY-MM-DD)
   * @returns ガルーンイベント配列
   */
  async getSchedule(
    startDate: string,
    endDate: string
  ): Promise<GaroonEvent[]> {
    try {
      // 日付のフォーマットを検証
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        throw new Error('日付フォーマットが不正です (YYYY-MM-DD)');
      }

      const endpoint = '/api/v1/schedule/events';
      const params = {
        rangeStart: `${startDate}T00:00:00Z`,
        rangeEnd: `${endDate}T23:59:59Z`,
        target: 'all',
      };

      let allEvents: GaroonEvent[] = [];
      let hasNext = true;
      let nextEventId: string | undefined;

      // ページネーションでイベントを全て取得
      while (hasNext) {
        const requestParams: any = { ...params };
        if (nextEventId) {
          requestParams.nextEventId = nextEventId;
        }

        const response = await this.client.get<GaroonScheduleResponse>(
          endpoint,
          { params: requestParams }
        );
        const {
          events,
          hasNext: moreEvents,
          nextEventId: nextId,
        } = response.data;

        allEvents = [...allEvents, ...events];
        hasNext = moreEvents;
        nextEventId = nextId;
      }

      return allEvents;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `ガルーンAPI呼び出しエラー: ${
              error.response.status
            } ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error(
            `ガルーンAPIリクエストエラー: サーバーからレスポンスがありません`
          );
        }
      }

      if (error instanceof Error) {
        throw new Error(`ガルーンAPIエラー: ${error.message}`);
      }

      throw new Error('不明なガルーンAPIエラー');
    }
  }

  /**
   * 単一のイベントを取得
   * @param eventId イベントID
   * @returns イベント情報
   */
  async getEvent(eventId: string): Promise<GaroonEvent> {
    try {
      const endpoint = `/api/v1/schedule/events/${eventId}`;
      const response = await this.client.get<GaroonEvent>(endpoint);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`イベントが見つかりません: ${eventId}`);
      }

      if (error instanceof Error) {
        throw new Error(`イベント取得エラー: ${error.message}`);
      }

      throw new Error('不明なイベント取得エラー');
    }
  }

  /**
   * Garoon APIの接続テスト
   * @returns 接続が成功したかどうか
   */
  async testConnection(): Promise<boolean> {
    try {
      // 1日分のスケジュールを取得してみる
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await this.getSchedule(today, today);
      return true;
    } catch (error) {
      console.error('Garoon接続テストエラー:', error);
      return false;
    }
  }
}
