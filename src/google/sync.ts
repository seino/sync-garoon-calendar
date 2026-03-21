// 同期ロジック

import { format, addDays } from 'date-fns';
import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from './calendar';
import { GaroonEvent } from '../types/garoon';
import { GoogleEvent } from '../types/google';
import { logger } from '../common/logger';

const log = logger.child({ module: 'Sync' });

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
  deleted: number;
  skipped: number;
  errors: number;
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * ガルーンイベントの表示用タイトルを取得する
 */
export function getDisplayTitle(event: GaroonEvent): string {
  return event.eventMenu
    ? `${event.eventMenu}: ${event.subject}`
    : event.subject;
}

/**
 * ガルーンイベントが終日イベントかどうかを判定する
 */
export function isAllDayEvent(event: GaroonEvent): boolean {
  if (event.isAllDay || event.eventType === 'ALL_DAY') {
    return true;
  }

  const startTime = event.start.dateTime.split('T')[1] || '';
  const endTime = event.end.dateTime.split('T')[1] || '';
  return (
    startTime.startsWith('00:00:00') &&
    (endTime.startsWith('00:00:00') || endTime.startsWith('23:59:59'))
  );
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
  const summary = getDisplayTitle(garoonEvent);

  let start: GoogleEvent['start'];
  let end: GoogleEvent['end'];

  if (isAllDayEvent(garoonEvent)) {
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

  log.info('同期期間', { startDate, endDate, days });

  // ガルーンからイベント取得
  log.info('ガルーンからスケジュール取得中...');
  const garoonEvents = await garoonClient.getSchedule(startDate, endDate);
  log.info('ガルーンイベント取得完了', { count: garoonEvents.length });

  if (garoonEvents.length === 0) {
    log.info('この期間にガルーンのイベントがありません');
    return { total: 0, created: 0, updated: 0, deleted: 0, skipped: 0, errors: 0 };
  }

  // Googleカレンダーから既存イベント取得（前後1週間広めに検索）
  log.info('Googleカレンダーから既存イベント取得中...');
  const googleSearchStart = new Date(today);
  googleSearchStart.setDate(googleSearchStart.getDate() - 7);
  const googleSearchEnd = addDays(today, days + 7);

  const googleEvents = await googleClient.listEvents(googleSearchStart, googleSearchEnd);
  log.info('Googleイベント取得完了', { count: googleEvents.length });

  if (dryRun) {
    log.info('ドライランモードのため、実際の同期は行いません');
    garoonEvents.forEach((event, index) => {
      const startTime = new Date(event.start.dateTime).toLocaleString('ja-JP');
      log.info(`[${index + 1}] ${getDisplayTitle(event)}`, { startTime });
    });
    return { total: garoonEvents.length, created: 0, updated: 0, deleted: 0, skipped: 0, errors: 0 };
  }

  log.info('同期実行中...');

  const result: SyncResult = { total: garoonEvents.length, created: 0, updated: 0, deleted: 0, skipped: 0, errors: 0 };
  const processedGoogleEventIds = new Set<string>();

  for (const garoonEvent of garoonEvents) {
    const title = getDisplayTitle(garoonEvent);

    try {
      if (excludePrivate && garoonEvent.visibilityType === 'PRIVATE') {
        log.info('スキップ（非公開）', { title });
        result.skipped++;
        continue;
      }

      const googleEvent = convertGaroonToGoogleEvent(garoonEvent);
      const existingEvent = findExistingEvent(googleEvents, garoonEvent.id, processedGoogleEventIds);

      if (existingEvent) {
        log.info('更新', { title });
        await googleClient.updateEvent(existingEvent.id!, googleEvent);
        processedGoogleEventIds.add(existingEvent.id!);
        result.updated++;
      } else {
        log.info('作成', { title });
        const newEventId = await googleClient.createEvent(googleEvent);
        processedGoogleEventIds.add(newEventId);
        result.created++;
      }
    } catch (error) {
      result.errors++;
      log.error('イベント同期エラー', { title, error });
    }
  }

  // Garoon から削除されたイベントを Google Calendar からも削除
  const garoonEventIds = new Set(garoonEvents.map((e) => e.id));
  for (const googleEvent of googleEvents) {
    const garoonId = googleEvent.extendedProperties?.private?.garoonEventId;
    if (!garoonId || !googleEvent.id) {
      continue;
    }
    if (processedGoogleEventIds.has(googleEvent.id)) {
      continue;
    }
    if (!garoonEventIds.has(garoonId)) {
      try {
        log.info('削除（ガルーンから削除済み）', { summary: googleEvent.summary, garoonId });
        await googleClient.deleteEvent(googleEvent.id);
        result.deleted++;
      } catch (error) {
        result.errors++;
        log.error('イベント削除エラー', { summary: googleEvent.summary, error });
      }
    }
  }

  return result;
}
