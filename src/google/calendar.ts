// Google Calendar API操作

import { google, calendar_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { GoogleCalendarConfig, GoogleEvent } from '../types/google';
import { withRetry } from '../common/retry';

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;

  constructor(config: GoogleCalendarConfig) {
    this.calendarId = config.calendarId;

    // 認証情報ファイルのパスを解決（パストラバーサル対策）
    const credentialsPath = this.resolveSecurePath(config.credentials);

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Google認証情報ファイルが見つかりません: ${credentialsPath}`);
    }

    // サービスアカウント認証を使用
    const auth = new GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * イベントを作成する
   * @param event 作成するイベント
   * @returns 作成されたイベントのID
   */
  async createEvent(event: GoogleEvent): Promise<string> {
    return withRetry(async () => {
      try {
        const response = await this.calendar.events.insert({
          calendarId: this.calendarId,
          requestBody: this.convertToRequestBody(event),
          sendUpdates: 'none', // 参加者への通知を無効化
        });

        if (!response.data.id) {
          throw new Error('イベントIDが返されませんでした');
        }

        return response.data.id;
      } catch (error: unknown) {
        if (error instanceof Error) {
          throw new Error(`イベントの作成に失敗しました: ${error.message}`);
        }
        throw new Error('イベントの作成に失敗しました: 不明なエラー');
      }
    });
  }

  /**
   * イベントを更新する
   * @param eventId 更新するイベントのID
   * @param event 更新内容
   */
  async updateEvent(eventId: string, event: GoogleEvent): Promise<void> {
    return withRetry(async () => {
      try {
        await this.calendar.events.update({
          calendarId: this.calendarId,
          eventId: eventId,
          requestBody: this.convertToRequestBody(event),
          sendUpdates: 'none', // 参加者への通知を無効化
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          throw new Error(`イベントの更新に失敗しました: ${error.message}`);
        }
        throw new Error('イベントの更新に失敗しました: 不明なエラー');
      }
    });
  }

  /**
   * イベントを削除する
   * @param eventId 削除するイベントのID
   */
  async deleteEvent(eventId: string): Promise<void> {
    return withRetry(async () => {
      try {
        await this.calendar.events.delete({
          calendarId: this.calendarId,
          eventId: eventId,
          sendUpdates: 'none', // 参加者への通知を無効化
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          throw new Error(`イベントの削除に失敗しました: ${error.message}`);
        }
        throw new Error('イベントの削除に失敗しました: 不明なエラー');
      }
    });
  }

  /**
   * 単一のイベントを取得する
   * @param eventId イベントID
   * @returns イベント（存在しない場合はnull）
   */
  async getEvent(eventId: string): Promise<GoogleEvent | null> {
    try {
      const response = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId,
      });

      const item = response.data;
      return this.convertFromApiResponse(item);
    } catch (error: unknown) {
      // 404エラーの場合はnullを返す
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: number }).code === 404
      ) {
        return null;
      }
      if (error instanceof Error) {
        throw new Error(`イベントの取得に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの取得に失敗しました: 不明なエラー');
    }
  }

  /**
   * 指定された期間のイベントを取得する
   * @param start 開始日時
   * @param end 終了日時
   * @returns イベントの配列
   */
  async listEvents(start: Date, end: Date): Promise<GoogleEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const items = response.data.items || [];
      return items.map((item) => this.convertFromApiResponse(item));
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの取得に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの取得に失敗しました: 不明なエラー');
    }
  }

  /**
   * Google Calendar APIへの接続テスト
   * @returns 接続が成功したかどうか
   */
  async testConnection(): Promise<boolean> {
    try {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: now.toISOString(),
        timeMax: oneHourLater.toISOString(),
        maxResults: 1,
      });

      return true;
    } catch (error) {
      console.error('Google Calendar接続テストエラー:', error);
      return false;
    }
  }

  /**
   * パストラバーサル対策を施したパス解決
   * @param inputPath 入力パス
   * @returns 安全に解決されたパス
   */
  private resolveSecurePath(inputPath: string): string {
    const baseDir = process.cwd();
    const resolvedPath = path.resolve(baseDir, inputPath);
    const normalizedPath = path.normalize(resolvedPath);

    // パストラバーサル検証: 解決後のパスがベースディレクトリ配下であることを確認
    if (!normalizedPath.startsWith(baseDir)) {
      throw new Error(
        `セキュリティエラー: 認証情報ファイルのパスがプロジェクトディレクトリ外を指しています`
      );
    }

    return normalizedPath;
  }

  /**
   * GoogleEventをAPI用のリクエストボディに変換
   */
  private convertToRequestBody(
    event: GoogleEvent
  ): calendar_v3.Schema$Event {
    const requestBody: calendar_v3.Schema$Event = {
      summary: event.summary,
      description: event.description,
      location: event.location,
      visibility: event.visibility,
    };

    // 開始時刻の設定
    if ('date' in event.start) {
      requestBody.start = { date: event.start.date };
    } else {
      requestBody.start = {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone,
      };
    }

    // 終了時刻の設定
    if ('date' in event.end) {
      requestBody.end = { date: event.end.date };
    } else {
      requestBody.end = {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone,
      };
    }

    // 参加者の設定
    if (event.attendees && event.attendees.length > 0) {
      requestBody.attendees = event.attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus,
        optional: a.optional,
      }));
    }

    // 拡張プロパティの設定
    if (event.extendedProperties) {
      requestBody.extendedProperties = {
        private: event.extendedProperties.private,
      };
    }

    // リマインダーの設定
    if (event.reminders) {
      requestBody.reminders = event.reminders;
    }

    return requestBody;
  }

  /**
   * APIレスポンスをGoogleEventに変換
   */
  private convertFromApiResponse(item: calendar_v3.Schema$Event): GoogleEvent {
    const event: GoogleEvent = {
      id: item.id || undefined,
      summary: item.summary || '',
      description: item.description || undefined,
      location: item.location || undefined,
      start: item.start?.date
        ? { date: item.start.date }
        : {
            dateTime: item.start?.dateTime || '',
            timeZone: item.start?.timeZone || 'Asia/Tokyo',
          },
      end: item.end?.date
        ? { date: item.end.date }
        : {
            dateTime: item.end?.dateTime || '',
            timeZone: item.end?.timeZone || 'Asia/Tokyo',
          },
      visibility: item.visibility as GoogleEvent['visibility'],
      status: item.status as GoogleEvent['status'],
    };

    // 参加者の変換
    if (item.attendees) {
      event.attendees = item.attendees.map((a) => ({
        email: a.email || '',
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || undefined,
        optional: a.optional || undefined,
      }));
    }

    // 拡張プロパティの変換
    if (item.extendedProperties?.private) {
      event.extendedProperties = {
        private: item.extendedProperties.private as {
          garoonEventId?: string;
          garoonUpdatedAt?: string;
        },
      };
    }

    return event;
  }
}
