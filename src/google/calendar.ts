// Google Calendar API操作

import { google, calendar_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';
import path from 'path';
import { GoogleCalendarConfig } from '../types/google';
import { GoogleEvent } from '../types/google';

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;

  constructor(config: GoogleCalendarConfig) {
    this.calendarId = config.calendarId;

    // 認証情報のパスを取得
    const keyFilePath = path.resolve(process.cwd(), config.credentials);

    // 認証設定
    const auth = new GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    // カレンダーAPIの初期化
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * イベントを作成
   * @param event イベント情報
   * @returns 作成されたイベントID
   */
  async createEvent(event: GoogleEvent): Promise<string> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event as calendar_v3.Schema$Event,
      });

      if (!response.data.id) {
        throw new Error('イベントIDが返されませんでした');
      }

      return response.data.id;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`イベント作成エラー: ${error.message}`);
      }
      throw new Error('不明なイベント作成エラー');
    }
  }

  /**
   * イベントを更新
   * @param eventId イベントID
   * @param event 更新するイベント情報
   * @returns 更新成功したかどうか
   */
  async updateEvent(eventId: string, event: GoogleEvent): Promise<boolean> {
    try {
      await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventId,
        requestBody: event as calendar_v3.Schema$Event,
      });

      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`イベント更新エラー: ${error.message}`);
      }
      throw new Error('不明なイベント更新エラー');
    }
  }

  /**
   * イベントを削除
   * @param eventId イベントID
   * @returns 削除成功したかどうか
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId,
      });

      return true;
    } catch (error) {
      if (error instanceof Error) {
        // 404エラーの場合は既に削除されているとみなす
        if (error.message.includes('404')) {
          return true;
        }
        throw new Error(`イベント削除エラー: ${error.message}`);
      }
      throw new Error('不明なイベント削除エラー');
    }
  }

  /**
   * イベントを取得
   * @param eventId イベントID
   * @returns イベント情報（存在しない場合はnull）
   */
  async getEvent(eventId: string): Promise<GoogleEvent | null> {
    try {
      const response = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId,
      });

      return response.data as GoogleEvent;
    } catch (error) {
      // 404エラーの場合はnullを返す
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }

      if (error instanceof Error) {
        throw new Error(`イベント取得エラー: ${error.message}`);
      }
      throw new Error('不明なイベント取得エラー');
    }
  }

  /**
   * ガルーンイベントIDによるイベント検索
   * @param garoonEventId ガルーンイベントID
   * @returns イベント情報（存在しない場合は空配列）
   */
  async findEventsByGaroonId(garoonEventId: string): Promise<GoogleEvent[]> {
    try {
      // 拡張プロパティでガルーンイベントIDを検索
      const query = `extendedProperties has { private: { garoonEventId: '${garoonEventId}' } }`;

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        privateExtendedProperty: [`garoonEventId=${garoonEventId}`],
        maxResults: 10,
      });

      return (response.data.items || []) as GoogleEvent[];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`イベント検索エラー: ${error.message}`);
      }
      throw new Error('不明なイベント検索エラー');
    }
  }

  /**
   * Google Calendar APIの接続テスト
   * @returns 接続が成功したかどうか
   */
  async testConnection(): Promise<boolean> {
    try {
      // カレンダー情報を取得してみる
      await this.calendar.calendars.get({
        calendarId: this.calendarId,
      });
      return true;
    } catch (error) {
      console.error('Google Calendar接続テストエラー:', error);
      return false;
    }
  }
}
