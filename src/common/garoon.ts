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
   * @param url マスキングするURL
   * @returns マスキングされたURL
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // ホスト名の一部をマスク
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

    // ベースURLのバリデーション
    if (!config.baseUrl) {
      throw new Error('ガルーンのベースURLが設定されていません');
    }

    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 末尾のスラッシュを削除

    // URLが有効か確認
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(this.baseUrl);
    } catch (e) {
      throw new Error(`ガルーンのベースURLが不正です: ${this.maskUrl(this.baseUrl)}`);
    }

    // HTTPSの検証（本番環境では必須）
    if (
      parsedUrl.protocol !== 'https:' &&
      process.env.NODE_ENV !== 'development'
    ) {
      throw new Error(
        'セキュリティエラー: ガルーンのURLはHTTPSである必要があります'
      );
    }

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

    // ターゲット設定の表示（機密情報はマスキング）
    const targetType = this.authConfig.targetType || 'user';

    console.log(
      `ガルーンAPIクライアントを初期化しました: ${this.maskUrl(this.baseUrl)}`
    );
    console.log(`ターゲットタイプ: ${targetType}`);
  }

  /**
   * 認証設定を行う
   * 参考: https://cybozu.dev/ja/garoon/docs/rest-api/overview/authentication/
   */
  private setupAuth(): void {
    const { apiToken, username, password } = this.authConfig;

    // 認証方法の選択
    if (username && password) {
      // 1. パスワード認証（ログイン名:パスワードをBase64エンコード）
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      this.client.defaults.headers.common['X-Cybozu-Authorization'] = auth;
      console.log('認証方式: パスワード認証を使用');
    } else if (apiToken) {
      // 2. APIトークン認証を使用
      this.client.defaults.headers.common['X-Cybozu-Authorization'] = apiToken;
      console.log('認証方式: APIトークン認証を使用');
    } else {
      throw new Error(
        '認証情報が設定されていません。GAROON_API_TOKENまたはGAROON_USERNAMEとGAROON_PASSWORDを設定してください'
      );
    }
  }

  /**
   * 指定期間のスケジュールを取得（複数ターゲット対応）
   * @param startDate 開始日 (YYYY-MM-DD)
   * @param endDate 終了日 (YYYY-MM-DD)
   * @returns ガルーンイベント配列
   */
  async getSchedule(
    startDate: string,
    endDate: string
  ): Promise<GaroonEvent[]> {
    // 日付のフォーマットを検証
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      throw new Error('日付フォーマットが不正です (YYYY-MM-DD)');
    }

    // 複数ターゲットが設定されている場合
    if (this.authConfig.targets && this.authConfig.targets.length > 0) {
      return this.getScheduleFromMultipleTargets(startDate, endDate);
    }

    // 単一ターゲット（旧形式）
    const target: GaroonTarget = {
      type: this.authConfig.targetType || 'user',
      id: this.authConfig.targetId || '2',
    };
    return this.getScheduleFromTarget(startDate, endDate, target);
  }

  /**
   * 複数ターゲットからスケジュールを取得してマージ
   * @param startDate 開始日 (YYYY-MM-DD)
   * @param endDate 終了日 (YYYY-MM-DD)
   * @returns マージされたガルーンイベント配列（重複排除済み）
   */
  private async getScheduleFromMultipleTargets(
    startDate: string,
    endDate: string
  ): Promise<GaroonEvent[]> {
    const targets = this.authConfig.targets!;
    console.log(
      `${targets.length}件のターゲットからイベントを取得します: ${targets.map((t) => `${t.type}:${t.id}`).join(', ')}`
    );

    // 各ターゲットから並列でイベントを取得
    const results = await Promise.allSettled(
      targets.map((target) =>
        this.getScheduleFromTarget(startDate, endDate, target)
      )
    );

    // イベントをマージして重複排除
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
   * @param startDate 開始日 (YYYY-MM-DD)
   * @param endDate 終了日 (YYYY-MM-DD)
   * @param target ターゲット情報
   * @returns ガルーンイベント配列
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

      // ページネーションでイベントを全て取得
      while (hasNext) {
        const requestParams: any = { ...params };
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
   * @param eventId イベントID
   * @returns イベント情報
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
   * @returns 接続が成功したかどうか
   * @throws エラー情報を含む例外
   */
  async testConnection(): Promise<boolean> {
    try {
      // 接続情報をデバッグ表示（機密情報はマスキング）
      console.log('デバッグ: Garoon接続テスト開始');
      console.log(`デバッグ: ベースURL: ${this.maskUrl(this.baseUrl)}`);

      // 認証方式の表示（機密情報は表示しない）
      const authHeaders = this.client.defaults.headers.common;
      const authMethod = authHeaders['X-Cybozu-Authorization']
        ? 'X-Cybozu-Authorization'
        : authHeaders['Authorization']
          ? 'Authorization (Basic)'
          : 'なし';
      console.log(`デバッグ: 認証方式: ${authMethod}`);

      // テスト用のシンプルなパラメータ
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const targetId = this.authConfig.targetId || '2';
      const targetType = this.authConfig.targetType || 'user';

      const params = {
        rangeStart: `${today}T00:00:00+09:00`,
        rangeEnd: `${today}T23:59:59+09:00`,
        target: targetId,
        targetType: targetType,
        fields: 'id,eventMenu,subject,notes,start,end',
      };

      // テスト用に直接エンドポイントを呼び出し
      const endpoint = '/api/v1/schedule/events';
      const response = await withRetry(() =>
        this.client.get(endpoint, { params })
      );

      console.log(`デバッグ: ステータスコード: ${response.status}`);
      console.log(`デバッグ: イベント数: ${response.data.events?.length || 0}`);

      return true;
    } catch (error) {
      console.error('Garoon接続テストエラー');
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error(`ステータスコード: ${error.response.status}`);
        } else if (error.request) {
          console.error('レスポンスなし: サーバーに接続できませんでした');
        }
        console.error(`エラーメッセージ: ${error.message}`);
      }
      // エラーを再スローして詳細情報を伝搬
      throw error;
    }
  }
}
