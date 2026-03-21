// Google Calendar API操作

import { google, calendar_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { GoogleCalendarConfig, GoogleEvent } from '../types/google';
import { withRetry } from '../common/retry';
import { logger } from '../common/logger';

const log = logger.child({ module: 'GoogleCalendar' });

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;

  constructor(config: GoogleCalendarConfig) {
    this.calendarId = config.calendarId;

    const credentialsPath = this.resolveSecurePath(config.credentials);

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Google認証情報ファイルが見つかりません: ${credentialsPath}`);
    }

    const auth = new GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * イベントを作成する
   */
  async createEvent(event: GoogleEvent): Promise<string> {
    try {
      return await withRetry(async () => {
        const requestBody = this.convertToRequestBody(event);
        const response = await this.calendar.events.insert({
          calendarId: this.calendarId,
          requestBody,
          sendUpdates: 'none',
        });

        if (!response.data.id) {
          throw new Error('イベントIDが返されませんでした');
        }

        return response.data.id;
      }, { operationName: 'イベント作成' });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの作成に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの作成に失敗しました: 不明なエラー');
    }
  }

  /**
   * イベントを更新する
   */
  async updateEvent(eventId: string, event: GoogleEvent): Promise<void> {
    try {
      await withRetry(async () => {
        await this.calendar.events.update({
          calendarId: this.calendarId,
          eventId: eventId,
          requestBody: this.convertToRequestBody(event),
          sendUpdates: 'none',
        });
      }, { operationName: 'イベント更新' });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの更新に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの更新に失敗しました: 不明なエラー');
    }
  }

  /**
   * イベントを削除する
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await withRetry(async () => {
        await this.calendar.events.delete({
          calendarId: this.calendarId,
          eventId: eventId,
          sendUpdates: 'none',
        });
      }, { operationName: 'イベント削除' });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの削除に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの削除に失敗しました: 不明なエラー');
    }
  }

  /**
   * 単一のイベントを取得する
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
   */
  async listEvents(start: Date, end: Date): Promise<GoogleEvent[]> {
    try {
      const allEvents: GoogleEvent[] = [];
      let pageToken: string | undefined;

      do {
        const response = await this.calendar.events.list({
          calendarId: this.calendarId,
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          pageToken,
        });

        const items = response.data.items || [];
        allEvents.push(...items.map((item) => this.convertFromApiResponse(item)));
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return allEvents;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの取得に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの取得に失敗しました: 不明なエラー');
    }
  }

  /**
   * カレンダー一覧を取得
   */
  async listCalendars(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`カレンダー一覧の取得に失敗しました: ${error.message}`);
      }
      throw new Error('カレンダー一覧の取得に失敗しました: 不明なエラー');
    }
  }

  /**
   * 接続テスト
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
      log.error('接続テストエラー', { error });
      return false;
    }
  }

  /**
   * パストラバーサル対策を施したパス解決
   */
  private resolveSecurePath(inputPath: string): string {
    const baseDir = process.cwd();
    const resolvedPath = path.resolve(baseDir, inputPath);
    const normalizedPath = path.normalize(resolvedPath);

    if (!normalizedPath.startsWith(baseDir)) {
      throw new Error(
        'セキュリティエラー: 認証情報ファイルのパスがプロジェクトディレクトリ外を指しています'
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

    if ('date' in event.start) {
      requestBody.start = { date: event.start.date };
    } else {
      requestBody.start = {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone,
      };
    }

    if ('date' in event.end) {
      requestBody.end = { date: event.end.date };
    } else {
      requestBody.end = {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone,
      };
    }

    if (event.attendees && event.attendees.length > 0) {
      requestBody.attendees = event.attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus,
        optional: a.optional,
      }));
    }

    if (event.extendedProperties) {
      requestBody.extendedProperties = {
        private: event.extendedProperties.private,
      };
    }

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

    if (item.attendees) {
      event.attendees = item.attendees.map((a) => ({
        email: a.email || '',
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || undefined,
        optional: a.optional || undefined,
      }));
    }

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
