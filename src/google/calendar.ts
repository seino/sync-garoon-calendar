// Google Calendar API操作

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { CalendarEvent } from '../types/calendar';

export class GoogleCalendarClient {
  private calendar: any;
  private calendarId: string;

  constructor(credentials: any, calendarId: string) {
    const auth = new OAuth2Client({
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      redirectUri: credentials.redirect_uris[0],
    });

    auth.setCredentials({
      refresh_token: credentials.refresh_token,
    });

    this.calendar = google.calendar({ version: 'v3', auth });
    this.calendarId = calendarId;
  }

  /**
   * イベントを作成する
   * @param event 作成するイベント
   * @returns 作成されたイベントのID
   */
  async createEvent(event: CalendarEvent): Promise<string> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: {
          summary: event.title,
          description: event.description,
          start: event.isAllDay
            ? { date: event.start.toISOString().split('T')[0] }
            : {
                dateTime: event.start.toISOString(),
                timeZone: 'Asia/Tokyo',
              },
          end: event.isAllDay
            ? { date: event.end.toISOString().split('T')[0] }
            : {
                dateTime: event.end.toISOString(),
                timeZone: 'Asia/Tokyo',
              },
          location: event.location,
          reminders: event.reminders || {
            useDefault: true
          }
        },
      });

      return response.data.id;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの作成に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの作成に失敗しました: 不明なエラー');
    }
  }

  /**
   * イベントを更新する
   * @param eventId 更新するイベントのID
   * @param event 更新内容
   */
  async updateEvent(eventId: string, event: CalendarEvent): Promise<void> {
    try {
      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventId,
        requestBody: {
          summary: event.title,
          description: event.description,
          start: event.isAllDay
            ? { date: event.start.toISOString().split('T')[0] }
            : {
                dateTime: event.start.toISOString(),
                timeZone: 'Asia/Tokyo',
              },
          end: event.isAllDay
            ? { date: event.end.toISOString().split('T')[0] }
            : {
                dateTime: event.end.toISOString(),
                timeZone: 'Asia/Tokyo',
              },
          location: event.location,
          reminders: event.reminders || {
            useDefault: true
          }
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの更新に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの更新に失敗しました: 不明なエラー');
    }
  }

  /**
   * イベントを削除する
   * @param eventId 削除するイベントのID
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの削除に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの削除に失敗しました: 不明なエラー');
    }
  }

  /**
   * 指定された期間のイベントを取得する
   * @param start 開始日時
   * @param end 終了日時
   * @returns イベントの配列
   */
  async listEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items.map((item: any) => ({
        id: item.id,
        title: item.summary,
        description: item.description || '',
        start: new Date(item.start.dateTime),
        end: new Date(item.end.dateTime),
        location: item.location || '',
      }));
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`イベントの取得に失敗しました: ${error.message}`);
      }
      throw new Error('イベントの取得に失敗しました: 不明なエラー');
    }
  }
}
