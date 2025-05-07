// 同期ロジック

import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from './calendar';
import { SyncDatabase } from '../common/database';
import { NotificationService } from '../common/notification';
import { AppConfig } from '../types/config';
import { GaroonEvent } from '../types/garoon';
import { GoogleEvent } from '../types/google';
import { loadConfig, validateConfig } from '../common/config';

export class SyncService {
  private garoon: GaroonClient;
  private googleCalendar: GoogleCalendarClient;
  private db: SyncDatabase;
  private notification: NotificationService;
  private config: AppConfig;

  // 同期状態の記録
  private syncStats = {
    added: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
  };

  constructor(config: AppConfig) {
    validateConfig(config);
    this.config = config;

    // 各クライアントの初期化
    this.garoon = new GaroonClient(config.garoon);
    this.googleCalendar = new GoogleCalendarClient(config.google);
    this.db = new SyncDatabase(config);
    this.notification = new NotificationService(config.teams);
  }

  /**
   * 指定期間のイベントを同期
   * @param startDate 開始日 (YYYY-MM-DD)
   * @param endDate 終了日 (YYYY-MM-DD)
   */
  async syncEvents(startDate?: string, endDate?: string): Promise<void> {
    try {
      // 日付が指定されていない場合は設定から取得
      if (!startDate) {
        const today = new Date();
        startDate = today.toISOString().slice(0, 10); // YYYY-MM-DD
      }

      if (!endDate) {
        const end = new Date();
        end.setDate(end.getDate() + this.config.sync.days);
        endDate = end.toISOString().slice(0, 10); // YYYY-MM-DD
      }

      console.log(`${startDate}から${endDate}までのイベントを同期します...`);

      // 同期統計情報のリセット
      this.resetSyncStats();

      // ガルーンからイベントを取得
      const events = await this.garoon.getSchedule(startDate, endDate);
      console.log(`ガルーンから${events.length}件のイベントを取得しました`);

      // イベントを同期
      for (const event of events) {
        // 非公開イベントの除外設定
        if (
          this.config.sync.excludePrivate &&
          event.visibilityType === 'PRIVATE'
        ) {
          continue;
        }

        try {
          await this.syncEvent(event);
        } catch (error) {
          this.syncStats.errors++;
          console.error(`イベント同期エラー (ID: ${event.id}):`, error);
          this.db.logSync(
            'ERROR',
            event.id,
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      // 同期結果を通知
      const { added, updated, deleted, errors } = this.syncStats;
      console.log(
        `同期完了: 追加=${added}, 更新=${updated}, 削除=${deleted}, エラー=${errors}`
      );

      // エラーがある場合のみ通知する設定の場合
      if (this.config.teams.notifyOnError) {
        if (errors > 0) {
          await this.notification.sendSyncResultNotification(
            added,
            updated,
            deleted,
            errors
          );
        }
      } else {
        // 常に通知する場合
        await this.notification.sendSyncResultNotification(
          added,
          updated,
          deleted,
          errors
        );
      }

      // 古い同期情報をクリーンアップ
      this.db.cleanupOldSyncInfo();
    } catch (error) {
      console.error('同期プロセスエラー:', error);

      // エラー通知
      if (this.config.teams.notifyOnError) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        await this.notification.sendErrorNotification(
          '同期プロセスエラー',
          errorMessage
        );
      }

      throw error;
    }
  }

  /**
   * 単一のイベントを同期
   * @param garoonEvent ガルーンイベント
   */
  private async syncEvent(garoonEvent: GaroonEvent): Promise<void> {
    // 同期情報を取得
    const syncInfo = this.db.getSyncInfo(garoonEvent.id);

    if (!syncInfo) {
      // 新規イベント
      await this.createGoogleEvent(garoonEvent);
    } else if (syncInfo.garoonUpdatedAt !== garoonEvent.updatedAt) {
      // 更新されたイベント
      await this.updateGoogleEvent(garoonEvent, syncInfo.googleEventId);
    } else {
      // 変更なし
      this.db.logSync('UNCHANGED', garoonEvent.id, syncInfo.googleEventId);
    }
  }

  /**
   * Google Calendarにイベントを作成
   * @param garoonEvent ガルーンイベント
   */
  private async createGoogleEvent(garoonEvent: GaroonEvent): Promise<void> {
    try {
      // ガルーンイベントをGoogleイベント形式に変換
      const googleEvent = this.convertToGoogleEvent(garoonEvent);

      // Googleカレンダーに作成
      const eventId = await this.googleCalendar.createEvent(googleEvent);

      // 同期情報を保存
      this.db.saveSyncInfo(garoonEvent.id, eventId, garoonEvent.updatedAt);
      this.db.logSync('CREATE', garoonEvent.id, eventId);

      this.syncStats.added++;
    } catch (error) {
      throw new Error(
        `イベント作成エラー (${garoonEvent.id}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Google Calendarのイベントを更新
   * @param garoonEvent ガルーンイベント
   * @param googleEventId GoogleイベントID
   */
  private async updateGoogleEvent(
    garoonEvent: GaroonEvent,
    googleEventId: string
  ): Promise<void> {
    try {
      // イベントが存在するか確認
      const existingEvent = await this.googleCalendar.getEvent(googleEventId);

      if (!existingEvent) {
        // イベントが存在しない場合は作成
        await this.createGoogleEvent(garoonEvent);
        return;
      }

      // ガルーンイベントをGoogleイベント形式に変換
      const googleEvent = this.convertToGoogleEvent(garoonEvent);

      // イベントIDを設定
      googleEvent.id = googleEventId;

      // Googleカレンダーで更新
      await this.googleCalendar.updateEvent(googleEventId, googleEvent);

      // 同期情報を更新
      this.db.saveSyncInfo(
        garoonEvent.id,
        googleEventId,
        garoonEvent.updatedAt
      );
      this.db.logSync('UPDATE', garoonEvent.id, googleEventId);

      this.syncStats.updated++;
    } catch (error) {
      throw new Error(
        `イベント更新エラー (${garoonEvent.id}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * ガルーンイベントをGoogleイベント形式に変換
   * @param garoonEvent ガルーンイベント
   * @returns Googleイベント
   */
  private convertToGoogleEvent(garoonEvent: GaroonEvent): GoogleEvent {
    const isAllDay =
      garoonEvent.isAllDay || garoonEvent.eventType === 'ALL_DAY';

    let start, end;

    if (isAllDay) {
      // 終日イベントの場合
      const startDate = garoonEvent.start.dateTime.split('T')[0];
      const endDate = garoonEvent.end.dateTime.split('T')[0];

      start = { date: startDate };
      end = { date: endDate };
    } else {
      // 通常イベントの場合
      start = {
        dateTime: garoonEvent.start.dateTime,
        timeZone: garoonEvent.start.timeZone || 'Asia/Tokyo',
      };

      end = {
        dateTime: garoonEvent.end.dateTime,
        timeZone: garoonEvent.end.timeZone || 'Asia/Tokyo',
      };
    }

    // 参加者リストの作成
    const attendees = garoonEvent.attendees
      .filter((a) => a.type === 'USER') // ユーザーのみを対象
      .map((a) => ({
        email: `${a.id}@example.com`, // 実際のメールアドレスがない場合のダミー
        displayName: a.name,
      }));

    // 場所情報
    const location = garoonEvent.location || '';

    // 説明 (メモ)
    const description = garoonEvent.notes
      ? `${garoonEvent.notes}\n\n(ガルーンから同期)`
      : '(ガルーンから同期)';

    // 可視性
    const visibility =
      garoonEvent.visibilityType === 'PRIVATE' ? 'private' : 'default';

    // Googleイベントオブジェクトの作成
    const googleEvent: GoogleEvent = {
      summary: garoonEvent.subject,
      description,
      location,
      start,
      end,
      attendees: attendees.length > 0 ? attendees : undefined,
      visibility,
      extendedProperties: {
        private: {
          garoonEventId: garoonEvent.id,
          garoonUpdatedAt: garoonEvent.updatedAt,
        },
      },
    };

    return googleEvent;
  }

  /**
   * 同期統計情報をリセット
   */
  private resetSyncStats(): void {
    this.syncStats = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
    };
  }

  /**
   * 同期統計情報を取得
   */
  getSyncStats(): typeof this.syncStats {
    return { ...this.syncStats };
  }

  /**
   * 各APIへの接続テスト
   * @returns テスト結果
   */
  async testConnections(): Promise<{ garoon: boolean; google: boolean }> {
    const garoonResult = await this.garoon.testConnection();
    const googleResult = await this.googleCalendar.testConnection();

    return {
      garoon: garoonResult,
      google: googleResult,
    };
  }
}

/**
 * 設定を読み込んで同期サービスを作成
 * @param configPath 設定ファイルのパス（省略可）
 * @returns 同期サービスのインスタンス
 */
export function createSyncService(configPath?: string): SyncService {
  const config = loadConfig(configPath);
  return new SyncService(config);
}

/**
 * 同期を実行する関数
 * @param configPath 設定ファイルのパス（省略可）
 * @param startDate 開始日 (YYYY-MM-DD)（省略可）
 * @param endDate 終了日 (YYYY-MM-DD)（省略可）
 */
export async function syncEvents(
  configPath?: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  const service = createSyncService(configPath);
  await service.syncEvents(startDate, endDate);
}
