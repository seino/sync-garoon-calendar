import { GoogleCalendarClient } from '../src/google/calendar';
import { GoogleCalendarConfig, GoogleEvent } from '../src/types/google';

// fs をモック
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

// google-auth-library をモック
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({})),
}));

// googleapis をモック
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockList = jest.fn();
const mockGet = jest.fn();
const mockCalendarListList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn(() => ({
      events: {
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        list: mockList,
        get: mockGet,
      },
      calendarList: {
        list: mockCalendarListList,
      },
    })),
  },
}));

describe('GoogleCalendarClient', () => {
  const mockConfig: GoogleCalendarConfig = {
    calendarId: 'test@example.com',
    credentials: 'credentials/test.json',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('正常な設定でインスタンスを生成できる', () => {
      expect(() => new GoogleCalendarClient(mockConfig)).not.toThrow();
    });
  });

  describe('createEvent', () => {
    it('イベントを作成し、IDを返す', async () => {
      mockInsert.mockResolvedValue({ data: { id: 'new-event-id' } });

      const client = new GoogleCalendarClient(mockConfig);
      const event: GoogleEvent = {
        summary: 'テスト会議',
        description: 'テスト説明',
        start: { dateTime: '2024-01-01T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-01-01T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
        location: '会議室A',
      };

      const result = await client.createEvent(event);

      expect(result).toBe('new-event-id');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'test@example.com',
          sendUpdates: 'none',
          requestBody: expect.objectContaining({
            summary: 'テスト会議',
            description: 'テスト説明',
            location: '会議室A',
          }),
        })
      );
    });

    it('APIエラー時に適切なエラーをスローする', async () => {
      mockInsert.mockRejectedValue(new Error('API Error'));

      const client = new GoogleCalendarClient(mockConfig);
      const event: GoogleEvent = {
        summary: 'テスト',
        start: { dateTime: '2024-01-01T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-01-01T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
      };

      await expect(client.createEvent(event)).rejects.toThrow('イベントの作成に失敗しました');
    });
  });

  describe('updateEvent', () => {
    it('イベントを更新できる', async () => {
      mockUpdate.mockResolvedValue({ data: {} });

      const client = new GoogleCalendarClient(mockConfig);
      const event: GoogleEvent = {
        summary: '更新後の会議',
        start: { dateTime: '2024-01-01T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-01-01T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
      };

      await expect(client.updateEvent('event-id', event)).resolves.toBeUndefined();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'test@example.com',
          eventId: 'event-id',
          sendUpdates: 'none',
        })
      );
    });
  });

  describe('deleteEvent', () => {
    it('イベントを削除できる', async () => {
      mockDelete.mockResolvedValue({ data: {} });

      const client = new GoogleCalendarClient(mockConfig);
      await expect(client.deleteEvent('event-id')).resolves.toBeUndefined();
      expect(mockDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'test@example.com',
          eventId: 'event-id',
          sendUpdates: 'none',
        })
      );
    });
  });

  describe('listEvents', () => {
    it('期間内のイベントを取得できる', async () => {
      mockList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'event-1',
              summary: 'イベント1',
              description: '説明1',
              start: { dateTime: '2024-01-01T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
              end: { dateTime: '2024-01-01T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
              location: '会議室A',
            },
          ],
        },
      });

      const client = new GoogleCalendarClient(mockConfig);
      const events = await client.listEvents(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('イベント1');
    });

    it('終日イベントを正しく変換する', async () => {
      mockList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'allday-1',
              summary: '終日イベント',
              start: { date: '2024-01-01' },
              end: { date: '2024-01-02' },
            },
          ],
        },
      });

      const client = new GoogleCalendarClient(mockConfig);
      const events = await client.listEvents(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(events[0].summary).toBe('終日イベント');
      expect('date' in events[0].start).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('接続成功時にtrueを返す', async () => {
      mockList.mockResolvedValue({ data: { items: [] } });

      const client = new GoogleCalendarClient(mockConfig);
      const result = await client.testConnection();

      expect(result).toBe(true);
    });

    it('接続失敗時にfalseを返す', async () => {
      mockList.mockRejectedValue(new Error('Connection failed'));

      const client = new GoogleCalendarClient(mockConfig);
      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });
});
