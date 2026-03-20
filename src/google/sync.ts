// 同期ロジック

import { format, addDays } from 'date-fns';
import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from './calendar';
import { GaroonEvent } from '../types/garoon';
import { GoogleEvent } from '../types/google';

export interface SyncOptions {
  garoonClient: GaroonClient;
  googleClient: GoogleCalendarClient;
  days: number;
  excludePrivate: boolean;
  dryRun?: boolean;
}

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * extendedPropertiesからGaroon IDを使って既存のGoogleイベントを検索する
 */
export function findExistingEvent(
  googleEvents: GoogleEvent[],
  garoonId: string,
  processedIds: Set<string>
): GoogleEvent | null {
  return (
    googleEvents.find((event) => {
      if (!event.id || processedIds.has(event.id)) {
        return false;
      }
      // extendedProperties で照合
      if (event.extendedProperties?.private?.garoonEventId === garoonId) {
        return true;
      }
      // フォールバック: 説明文の [Garoon ID: xxx] タグで照合（旧形式互換）
      return event.description?.includes(`[Garoon ID: ${garoonId}]`) ?? false;
    }) || null
  );
}

/**
 * GaroonイベントをGoogleEvent形式に変換する
 */
export function convertGaroonToGoogleEvent(garoonEvent: GaroonEvent): GoogleEvent {
  const summary = garoonEvent.eventMenu
    ? `${garoonEvent.eventMenu}: ${garoonEvent.subject}`
    : garoonEvent.subject;

  // 終日イベントの判定
  const startTime = garoonEvent.start.dateTime.split('T')[1] || '';
  const endTime = garoonEvent.end.dateTime.split('T')[1] || '';
  const hasNoTime =
    startTime.startsWith('00:00:00') &&
    (endTime.startsWith('00:00:00') || endTime.startsWith('23:59:59'));

  const isAllDay =
    garoonEvent.isAllDay ||
    garoonEvent.eventType === 'ALL_DAY' ||
    hasNoTime;

  let start: GoogleEvent['start'];
  let end: GoogleEvent['end'];

  if (isAllDay) {
    const startDate = garoonEvent.start.dateTime.split('T')[0];
    const endDateRaw = garoonEvent.end.dateTime.split('T')[0];
    // Google Calendar の終日イベントは終了日が「翌日」である必要がある
    const endDateObj = new Date(endDateRaw);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endDate = endDateObj.toISOString().split('T')[0];

    start = { date: startDate };
    end = { date: endDate };
  } else {
    start = {
      dateTime: garoonEvent.start.dateTime,
      timeZone: garoonEvent.start.timeZone || 'Asia/Tokyo',
    };
    end = {
      dateTime: garoonEvent.end.dateTime,
      timeZone: garoonEvent.end.timeZone || 'Asia/Tokyo',
    };
  }

  // 参加者情報を説明欄に含める
  const attendeeNames = garoonEvent.attendees
    .filter((a) => a.type === 'USER')
    .map((a) => a.name)
    .join(', ');

  let description = garoonEvent.notes || '';
  if (attendeeNames) {
    description += `\n\n参加者: ${attendeeNames}`;
  }

  const visibility =
    garoonEvent.visibilityType === 'PRIVATE' ? 'private' : 'default';

  return {
    summary,
    description,
    location: garoonEvent.location || '',
    start,
    end,
    visibility,
    extendedProperties: {
      private: {
        garoonEventId: garoonEvent.id,
        garoonUpdatedAt: garoonEvent.updatedAt,
      },
    },
  };
}

/**
 * Garoon → Google Calendar の同期を実行する
 */
export async function syncEvents(options: SyncOptions): Promise<SyncResult> {
  const { garoonClient, googleClient, days, excludePrivate, dryRun } = options;

  const today = new Date();
  const startDate = formatDate(today);
  const endDate = formatDate(addDays(today, days));

  console.log(`同期期間: ${startDate} ～ ${endDate} (${days}日間)`);

  // ガルーンからイベント取得
  console.log('ガルーンからスケジュール取得中...');
  const garoonEvents = await garoonClient.getSchedule(startDate, endDate);
  console.log(`ガルーンイベント: ${garoonEvents.length}件`);

  if (garoonEvents.length === 0) {
    console.log('この期間にガルーンのイベントがありません。');
    return { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  // Googleカレンダーから既存イベント取得（前後1週間広めに検索）
  console.log('Googleカレンダーから既存イベント取得中...');
  const googleSearchStart = new Date(today);
  googleSearchStart.setDate(googleSearchStart.getDate() - 7);
  const googleSearchEnd = addDays(today, days + 7);

  const googleEvents = await googleClient.listEvents(googleSearchStart, googleSearchEnd);
  console.log(`Googleイベント: ${googleEvents.length}件\n`);

  if (dryRun) {
    console.log('ドライランモードのため、実際の同期は行いません');
    garoonEvents.forEach((event, index) => {
      const displayTitle = event.eventMenu
        ? `${event.eventMenu}: ${event.subject}`
        : event.subject;
      const startTime = new Date(event.start.dateTime).toLocaleString('ja-JP');
      console.log(`[${index + 1}] ${displayTitle} (${startTime})`);
    });
    return { total: garoonEvents.length, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  console.log('同期実行中...');
  console.log('----------------');

  const result: SyncResult = { total: garoonEvents.length, created: 0, updated: 0, skipped: 0, errors: 0 };
  const processedGoogleEventIds = new Set<string>();

  for (const garoonEvent of garoonEvents) {
    try {
      const displayTitle = garoonEvent.eventMenu
        ? `${garoonEvent.eventMenu}: ${garoonEvent.subject}`
        : garoonEvent.subject;

      if (excludePrivate && garoonEvent.visibilityType === 'PRIVATE') {
        console.log(`スキップ: ${displayTitle} (非公開)`);
        result.skipped++;
        continue;
      }

      const googleEvent = convertGaroonToGoogleEvent(garoonEvent);
      const existingEvent = findExistingEvent(googleEvents, garoonEvent.id, processedGoogleEventIds);

      if (existingEvent) {
        console.log(`更新: ${displayTitle}`);
        await googleClient.updateEvent(existingEvent.id!, googleEvent);
        processedGoogleEventIds.add(existingEvent.id!);
        result.updated++;
      } else {
        console.log(`作成: ${displayTitle}`);
        const newEventId = await googleClient.createEvent(googleEvent);
        processedGoogleEventIds.add(newEventId);
        result.created++;
      }
    } catch (error) {
      result.errors++;
      const displayTitle = garoonEvent.eventMenu
        ? `${garoonEvent.eventMenu}: ${garoonEvent.subject}`
        : garoonEvent.subject;
      console.error(`[SyncService] エラー: ${displayTitle} - ${error}`);
    }
  }

  return result;
}
