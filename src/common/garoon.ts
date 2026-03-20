// Garoon API操作

import axios, { AxiosInstance } from 'axios';
import {
  GaroonAuthConfig,
  GaroonEvent,
  GaroonScheduleResponse,
  GaroonTarget,
} from '../types/garoon';
import { withRetry } from './retry';

export class GaroonClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private authConfig: GaroonAuthConfig;

  /**
   * URLをマスキングして安全に表示
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      const maskedHost =
        host.length > 4
          ? host.substring(0, 2) + '***' + host.substring(host.length - 2)
          : '***';
      return `${parsed.protocol}//${maskedHost}`;
    } catch {
      return '***invalid-url***';
    }
  }

  constructor(config: GaroonAuthConfig) {
    this.authConfig = config;

    if (!config.baseUrl) {
      throw new Error('ガルーンのベースURLが設定されていません');
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, '');

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(this.baseUrl);
    } catch (e) {
      throw new Error(`ガルーンのベースURLが不正です: ${this.maskUrl(this.baseUrl)}`);
    }

    if (
      parsedUrl.protocol !== 'https:' &&
      process.env.NODE_ENV !== 'development'
    ) {
      throw new Error(
        'セキュリティエラー: ガルーンのURLはHTTPSである必要があります'
      );
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    this.setupAuth();

    const targetType = this.authConfig.targetType || 'user';
    console.log(
      `ガルーンAPIクライアントを初期化しました: ${this.maskUrl(this.baseUrl)}`
    );
    console.log(`ターゲットタイプ: ${targetType}`);
  }

  /**
   * 認証設定を行う
   */
  private setupAuth(): void {
    const { apiToken, username, password } = this.authConfig;

    if (username && password) {
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      this.client.defaults.headers.common['X-Cybozu-Authorization'] = auth;
      console.log('認証方式: パスワード認証を使用');
    } else if (apiToken) {
      this.client.defaults.headers.common['X-Cybozu-Authorization'] = apiToken;
      console.log('認証方式: APIトークン認証を使用');
    } else {
      throw new Error(
        '認証情報が設定されていません。GAROON_API_TOKEN または GAROON_USERNAME/GAROON_PASSWORD を設定してください'
      );
    }
  }

  /**
   * 指定期間のスケジュールを取得（複数ターゲット対応）
   */
  async getSchedule(
    startDate: string,
    endDate: string
  ): Promise<GaroonEvent[]> {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      throw new Error('日付フォーマットが不正です (YYYY-MM-DD)');
    }

    if (this.authConfig.targets && this.authConfig.targets.length > 0) {
      return this.getScheduleFromMultipleTargets(startDate, endDate);
    }

    const target: GaroonTarget = {
      type: this.authConfig.targetType || 'user',
      id: this.authConfig.targetId || '2',
    };
    return this.getScheduleFromTarget(startDate, endDate, target);
  }

  /**
   * 複数ターゲットからスケジュールを取得してマージ
   */
  private async getScheduleFromMultipleTargets(
    startDate: string,
    endDate: string
  ): Promise<GaroonEvent[]> {
    const targets = this.authConfig.targets!;
    console.log(
      `${targets.length}件のターゲットからイベントを取得します: ${targets.map((t) => `${t.type}:${t.id}`).join(', ')}`
    );

    const results = await Promise.allSettled(
      targets.map((target) =>
        this.getScheduleFromTarget(startDate, endDate, target)
      )
    );

    const eventMap = new Map<string, GaroonEvent>();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(
          `${targets[index].type}:${targets[index].id} から ${result.value.length} 件のイベントを取得`
        );
        for (const event of result.value) {
          eventMap.set(event.id, event);
        }
      } else {
        console.error(
          `${targets[index].type}:${targets[index].id} からのイベント取得に失敗: ${result.reason}`
        );
      }
    });

    const allEvents = Array.from(eventMap.values());
    console.log(`合計 ${allEvents.length} 件のユニークなイベント`);
    return allEvents;
  }

  /**
   * 単一ターゲットからスケジュールを取得
   */
  private async getScheduleFromTarget(
    startDate: string,
    endDate: string,
    target: GaroonTarget
  ): Promise<GaroonEvent[]> {
    try {
      const endpoint = '/api/v1/schedule/events';

      const params = {
        rangeStart: `${startDate}T00:00:00+09:00`,
        rangeEnd: `${endDate}T23:59:59+09:00`,
        target: target.id,
        targetType: target.type,
        fields:
          'id,eventMenu,subject,notes,start,end,attendees,visibilityType,eventType,updatedAt,createdAt,location',
      };

      let allEvents: GaroonEvent[] = [];
      let hasNext = true;
      let nextEventId: string | undefined;

      while (hasNext) {
        const requestParams: Record<string, string> = { ...params };
        if (nextEventId) {
          requestParams.nextEventId = nextEventId;
        }

        const response = await withRetry(() =>
          this.client.get<GaroonScheduleResponse>(endpoint, {
            params: requestParams,
          })
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
            `ガルーンAPI呼び出しエラー (${target.type}:${target.id}): ${
              error.response.status
            } ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error(
            `ガルーンAPIリクエストエラー (${target.type}:${target.id}): サーバーからレスポンスがありません`
          );
        }
      }

      if (error instanceof Error) {
        throw new Error(
          `ガルーンAPIエラー (${target.type}:${target.id}): ${error.message}`
        );
      }

      throw new Error(`不明なガルーンAPIエラー (${target.type}:${target.id})`);
    }
  }

  /**
   * 単一のイベントを取得
   */
  async getEvent(eventId: string): Promise<GaroonEvent> {
    try {
      const endpoint = `/api/v1/schedule/events/${eventId}`;
      const response = await withRetry(() =>
        this.client.get<GaroonEvent>(endpoint)
      );
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
   */
  async testConnection(): Promise<boolean> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const targetId = this.authConfig.targetId || '2';
      const targetType = this.authConfig.targetType || 'user';

      const params = {
        rangeStart: `${today}T00:00:00+09:00`,
        rangeEnd: `${today}T23:59:59+09:00`,
        target: targetId,
        targetType: targetType,
        fields: 'id,eventMenu,subject,notes,start,end',
      };

      const endpoint = '/api/v1/schedule/events';
      await withRetry(() => this.client.get(endpoint, { params }));

      return true;
    } catch (error) {
      console.error('[GaroonClient] 接続テストに失敗しました:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error(`[GaroonClient] ステータスコード: ${error.response.status}`);
        } else if (error.request) {
          console.error('[GaroonClient] サーバーに接続できませんでした');
        }
      }
      throw error;
    }
  }
}
