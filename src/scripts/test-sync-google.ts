// GaroonからGoogleカレンダーへの同期テストスクリプト
// デバッグ情報を表示しつつ同期を実行する

import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from '../google/calendar';
import { loadConfig } from '../common/config';
import { syncEvents, formatDate } from '../google/sync';
import { addDays } from 'date-fns';
import { logger } from '../common/logger';

const log = logger.child({ module: 'TestSyncGoogle' });

async function main() {
  try {
    log.info('Garoon → Google Calendar 同期テスト開始');

    // コマンドライン引数
    const configArg = process.argv.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;
    const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
    const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 3;
    const testOnly = process.argv.includes('--test-only');

    // 設定・クライアント初期化
    const config = loadConfig(configPath);
    const garoonClient = new GaroonClient(config.garoon);
    const googleClient = new GoogleCalendarClient(config.google);

    // 1. 接続テスト
    log.info('接続テスト開始');

    log.info('ガルーンAPIに接続中...');
    await garoonClient.testConnection();
    log.info('ガルーンAPI接続成功');

    log.info('Google Calendar APIに接続中...');
    const connected = await googleClient.testConnection();
    if (!connected) {
      throw new Error('Google Calendar API接続失敗');
    }
    log.info('Google Calendar API接続成功');

    // 2. データ取得プレビュー
    log.info('データ取得テスト開始');

    const today = new Date();
    const startDate = formatDate(today);
    const endDate = formatDate(addDays(today, days));
    log.info('取得期間', { startDate, endDate, days });

    log.info('ガルーンからイベント取得中...');
    const garoonEvents = await garoonClient.getSchedule(startDate, endDate);
    log.info('ガルーンイベント取得完了', { count: garoonEvents.length });

    if (garoonEvents.length > 0) {
      garoonEvents.forEach((event, index) => {
        const startTime = new Date(event.start.dateTime).toLocaleString('ja-JP');
        const endTime = new Date(event.end.dateTime).toLocaleString('ja-JP');
        const isPrivate = event.visibilityType === 'PRIVATE';
        const displayTitle = event.eventMenu
          ? `${event.eventMenu}: ${event.subject}`
          : event.subject;

        log.info(`[${index + 1}] ${displayTitle}`, {
          id: event.id,
          startTime,
          endTime,
          location: event.location || undefined,
          attendees: event.attendees.length,
          isPrivate,
        });
      });
    }

    if (testOnly) {
      log.info('テストモードのため、実際の同期は行いません');
      return;
    }

    // 3. 同期テスト実行
    log.info('同期テスト実行開始');

    const result = await syncEvents({
      garoonClient,
      googleClient,
      days,
      excludePrivate: config.sync.excludePrivate,
    });

    log.info('同期テスト結果', {
      total: result.total,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    });

    if (result.errors > 0) {
      log.warn('一部のイベントで同期エラーが発生しました');
    }
  } catch (error) {
    log.error('テスト実行中にエラーが発生しました', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

main();
