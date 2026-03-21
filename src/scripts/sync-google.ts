// GaroonからGoogleカレンダーへの同期（本番用）

import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from '../google/calendar';
import { NotificationService } from '../common/notification';
import { loadConfig } from '../common/config';
import { syncEvents } from '../google/sync';
import { logger } from '../common/logger';

const log = logger.child({ module: 'SyncGoogle' });

async function main() {
  try {
    log.info('Garoon → Google Calendar 同期開始', {
      timestamp: new Date().toLocaleString('ja-JP'),
    });

    // コマンドライン引数
    const configArg = process.argv.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;
    const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
    const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;
    const dryRun = process.argv.includes('--dry-run');

    // 設定・クライアント初期化
    const config = loadConfig(configPath);
    const garoonClient = new GaroonClient(config.garoon);
    const googleClient = new GoogleCalendarClient(config.google);
    const notificationService = new NotificationService(config.teams);

    // 接続テスト
    log.info('接続確認中...');
    await garoonClient.testConnection();
    const googleConnected = await googleClient.testConnection();
    if (!googleConnected) {
      throw new Error('Google Calendar APIへの接続に失敗しました');
    }
    log.info('接続確認完了');

    // 同期実行
    const result = await syncEvents({
      garoonClient,
      googleClient,
      days,
      excludePrivate: config.sync.excludePrivate,
      dryRun,
    });

    if (dryRun) {
      log.info('ドライランモードのため、実際の同期は行いませんでした');
      return;
    }

    // 結果表示
    log.info('同期完了', {
      total: result.total,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      skipped: result.skipped,
      errors: result.errors,
      timestamp: new Date().toLocaleString('ja-JP'),
    });

    // Teams通知
    try {
      await notificationService.sendSyncResultNotification(
        result.created,
        result.updated,
        result.deleted,
        result.errors
      );
    } catch (notifyError) {
      log.warn('Teams通知の送信に失敗しました', { error: notifyError });
    }

    if (result.errors > 0) {
      log.warn('一部のイベントで同期エラーが発生しました');
      process.exit(1);
    }
  } catch (error) {
    log.error('同期処理中にエラーが発生しました', {
      error: error instanceof Error ? error.message : error,
    });

    try {
      const config = loadConfig();
      const notificationService = new NotificationService(config.teams);
      await notificationService.sendErrorNotification(
        '同期処理で致命的なエラーが発生しました',
        error instanceof Error ? error.message : String(error)
      );
    } catch (notifyError) {
      log.warn('Teams通知の送信に失敗しました', { error: notifyError });
    }

    process.exit(1);
  }
}

main();
