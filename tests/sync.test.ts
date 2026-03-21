import {
  formatDate,
  findExistingEvent,
  convertGaroonToGoogleEvent,
  getDisplayTitle,
  isAllDayEvent,
} from '../src/google/sync';
import { GoogleEvent } from '../src/types/google';
import { GaroonEvent } from '../src/types/garoon';

describe('sync', () => {
  describe('formatDate', () => {
    it('DateオブジェクトをYYYY-MM-DD形式に変換する', () => {
      const date = new Date('2024-03-15T10:00:00+09:00');
      expect(formatDate(date)).toBe('2024-03-15');
    });

    it('月・日が1桁の場合もゼロ埋めする', () => {
      const date = new Date('2024-01-05T00:00:00+09:00');
      expect(formatDate(date)).toBe('2024-01-05');
    });
  });

  describe('findExistingEvent', () => {
    const googleEvents: GoogleEvent[] = [
      {
        id: 'google-1',
        summary: 'イベント1',
        description: 'テスト',
        start: { dateTime: '2024-03-15T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-03-15T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
        extendedProperties: { private: { garoonEventId: '100' } },
      },
      {
        id: 'google-2',
        summary: 'イベント2',
        description: '説明文\n\n[Garoon ID: 200]',
        start: { dateTime: '2024-03-15T13:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-03-15T14:00:00+09:00', timeZone: 'Asia/Tokyo' },
      },
      {
        id: 'google-3',
        summary: 'イベント3',
        description: 'Garoon IDなし',
        start: { dateTime: '2024-03-15T15:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-03-15T16:00:00+09:00', timeZone: 'Asia/Tokyo' },
      },
    ];

    it('extendedPropertiesのgaroonEventIdで既存イベントを見つける', () => {
      const result = findExistingEvent(googleEvents, '100', new Set());
      expect(result).not.toBeNull();
      expect(result!.id).toBe('google-1');
    });

    it('説明文のGaroon IDタグでも既存イベントを見つける（旧形式互換）', () => {
      const result = findExistingEvent(googleEvents, '200', new Set());
      expect(result).not.toBeNull();
      expect(result!.id).toBe('google-2');
    });

    it('存在しないGaroon IDの場合nullを返す', () => {
      const result = findExistingEvent(googleEvents, '999', new Set());
      expect(result).toBeNull();
    });

    it('既に処理済みのイベントを除外する', () => {
      const processedIds = new Set(['google-1']);
      const result = findExistingEvent(googleEvents, '100', processedIds);
      expect(result).toBeNull();
    });

    it('Garoon IDタグがない場合はマッチしない', () => {
      const result = findExistingEvent(googleEvents, '3', new Set());
      expect(result).toBeNull();
    });
  });

  describe('convertGaroonToGoogleEvent', () => {
    const baseGaroonEvent: GaroonEvent = {
      id: '100',
      subject: 'テスト会議',
      start: {
        dateTime: '2024-03-15T10:00:00+09:00',
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: '2024-03-15T11:00:00+09:00',
        timeZone: 'Asia/Tokyo',
      },
      isAllDay: false,
      notes: '会議メモ',
      attendees: [],
      visibilityType: 'PUBLIC',
      eventType: 'REGULAR',
      updatedAt: '2024-03-15T09:00:00+09:00',
      createdAt: '2024-03-14T09:00:00+09:00',
      location: '会議室A',
    };

    it('GaroonイベントをGoogleEvent形式に変換する', () => {
      const result = convertGaroonToGoogleEvent(baseGaroonEvent);

      expect(result.summary).toBe('テスト会議');
      expect(result.location).toBe('会議室A');
      expect(result.description).toContain('会議メモ');
      expect(result.extendedProperties?.private?.garoonEventId).toBe('100');
    });

    it('eventMenuがある場合はタイトルに含める', () => {
      const eventWithMenu = { ...baseGaroonEvent, eventMenu: '外出' };
      const result = convertGaroonToGoogleEvent(eventWithMenu);

      expect(result.summary).toBe('外出: テスト会議');
    });

    it('eventMenuがない場合はsubjectのみ', () => {
      const result = convertGaroonToGoogleEvent(baseGaroonEvent);
      expect(result.summary).toBe('テスト会議');
    });

    it('locationがない場合は空文字列', () => {
      const eventNoLocation = { ...baseGaroonEvent, location: undefined };
      const result = convertGaroonToGoogleEvent(eventNoLocation);
      expect(result.location).toBe('');
    });

    it('notesがない場合でもextendedPropertiesにgaroonEventIdが設定される', () => {
      const eventNoNotes = { ...baseGaroonEvent, notes: undefined };
      const result = convertGaroonToGoogleEvent(eventNoNotes);
      expect(result.extendedProperties?.private?.garoonEventId).toBe('100');
    });

    it('通常イベントはdateTime形式で変換される', () => {
      const result = convertGaroonToGoogleEvent(baseGaroonEvent);
      expect('dateTime' in result.start).toBe(true);
      expect('dateTime' in result.end).toBe(true);
    });

    it('終日イベントはdate形式で変換される', () => {
      const allDayEvent: GaroonEvent = {
        ...baseGaroonEvent,
        isAllDay: true,
        eventType: 'ALL_DAY',
        start: { dateTime: '2024-03-15T00:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-03-15T23:59:59+09:00', timeZone: 'Asia/Tokyo' },
      };
      const result = convertGaroonToGoogleEvent(allDayEvent);

      expect('date' in result.start).toBe(true);
      expect('date' in result.end).toBe(true);
    });

    it('PRIVATEイベントはvisibilityがprivateになる', () => {
      const privateEvent = { ...baseGaroonEvent, visibilityType: 'PRIVATE' };
      const result = convertGaroonToGoogleEvent(privateEvent);
      expect(result.visibility).toBe('private');
    });

    it('参加者情報が説明文に含まれる', () => {
      const eventWithAttendees = {
        ...baseGaroonEvent,
        attendees: [
          { id: '1', type: 'USER' as const, name: '田中太郎' },
          { id: '2', type: 'USER' as const, name: '鈴木花子' },
        ],
      };
      const result = convertGaroonToGoogleEvent(eventWithAttendees);
      expect(result.description).toContain('参加者: 田中太郎, 鈴木花子');
    });

    it('USER以外の参加者は説明文に含めない', () => {
      const eventWithFacility = {
        ...baseGaroonEvent,
        attendees: [
          { id: '1', type: 'FACILITY' as const, name: '会議室B' },
          { id: '2', type: 'ORGANIZATION' as const, name: '開発部' },
        ],
      };
      const result = convertGaroonToGoogleEvent(eventWithFacility);
      expect(result.description).not.toContain('参加者');
    });

    it('notesがundefinedの場合は空文字列が説明文になる', () => {
      const eventNoNotes = { ...baseGaroonEvent, notes: undefined };
      const result = convertGaroonToGoogleEvent(eventNoNotes);
      expect(result.description).toBe('');
    });
  });

  describe('getDisplayTitle', () => {
    const baseEvent: GaroonEvent = {
      id: '1',
      subject: 'ミーティング',
      start: { dateTime: '2024-03-15T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
      end: { dateTime: '2024-03-15T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
      isAllDay: false,
      attendees: [],
      visibilityType: 'PUBLIC',
      eventType: 'REGULAR',
      updatedAt: '2024-03-15T09:00:00+09:00',
      createdAt: '2024-03-14T09:00:00+09:00',
    };

    it('eventMenuがある場合は「メニュー: 件名」形式で返す', () => {
      const event = { ...baseEvent, eventMenu: '外出' };
      expect(getDisplayTitle(event)).toBe('外出: ミーティング');
    });

    it('eventMenuがundefinedの場合はsubjectのみ返す', () => {
      expect(getDisplayTitle(baseEvent)).toBe('ミーティング');
    });

    it('eventMenuが空文字列の場合はsubjectのみ返す', () => {
      const event = { ...baseEvent, eventMenu: '' };
      expect(getDisplayTitle(event)).toBe('ミーティング');
    });
  });

  describe('isAllDayEvent', () => {
    const baseEvent: GaroonEvent = {
      id: '1',
      subject: 'テスト',
      start: { dateTime: '2024-03-15T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
      end: { dateTime: '2024-03-15T11:00:00+09:00', timeZone: 'Asia/Tokyo' },
      isAllDay: false,
      attendees: [],
      visibilityType: 'PUBLIC',
      eventType: 'REGULAR',
      updatedAt: '2024-03-15T09:00:00+09:00',
      createdAt: '2024-03-14T09:00:00+09:00',
    };

    it('isAllDay=trueの場合はtrueを返す', () => {
      const event = { ...baseEvent, isAllDay: true };
      expect(isAllDayEvent(event)).toBe(true);
    });

    it('eventType=ALL_DAYの場合はtrueを返す', () => {
      const event: GaroonEvent = { ...baseEvent, eventType: 'ALL_DAY' };
      expect(isAllDayEvent(event)).toBe(true);
    });

    it('00:00:00〜23:59:59は終日イベントと判定する', () => {
      const event = {
        ...baseEvent,
        start: { dateTime: '2024-03-15T00:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-03-15T23:59:59+09:00', timeZone: 'Asia/Tokyo' },
      };
      expect(isAllDayEvent(event)).toBe(true);
    });

    it('00:00:00〜00:00:00は終日イベントと判定する', () => {
      const event = {
        ...baseEvent,
        start: { dateTime: '2024-03-15T00:00:00+09:00', timeZone: 'Asia/Tokyo' },
        end: { dateTime: '2024-03-16T00:00:00+09:00', timeZone: 'Asia/Tokyo' },
      };
      expect(isAllDayEvent(event)).toBe(true);
    });

    it('通常の時間帯イベントはfalseを返す', () => {
      expect(isAllDayEvent(baseEvent)).toBe(false);
    });
  });
});
