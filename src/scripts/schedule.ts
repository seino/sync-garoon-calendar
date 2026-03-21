// ガルーン → Google Calendar 定期同期スクリプト

import cron from 'node-cron';
import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from '../google/calendar';
import { NotificationService } from '../common/notification';
import { loadConfig } from '../common/config';
import { AppConfig } from '../types/config';
import { syncEvents } from '../google/sync';
import { logger } from '../common/logger';

const log = logger.child({ module: 'Scheduler' });

interface SyncClients {
  garoonClient: GaroonClient;
  googleClient: GoogleCalendarClient;
  notificationService: NotificationService;
  config: AppConfig;
}

async function runSync(clients: SyncClients): Promise<void> {
  const { garoonClient, googleClient, notificationService, config } = clients;

  log.info('定期同期開始', {
    timestamp: new Date().toLocaleString('ja-JP'),
  });

  const result = await syncEvents({
    garoonClient,
    googleClient,
    days: 7,
    excludePrivate: config.sync.excludePrivate,
  });

  log.info('同期完了', {
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
    skipped: result.skipped,
    errors: result.errors,
    timestamp: new Date().toLocaleString('ja-JP'),
  });

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
}

async function main(): Promise<void> {
  log.info('定期同期スケジューラーを起動します');

  try {
    const config = loadConfig();
    const clients: SyncClients = {
      garoonClient: new GaroonClient(config.garoon),
      googleClient: new GoogleCalendarClient(config.google),
      notificationService: new NotificationService(config.teams),
      config,
    };

    const intervalMinutes = config.sync.intervalMinutes || 15;
    const cronExpression = `*/${intervalMinutes} * * * *`;

    log.info('スケジューラー設定', { intervalMinutes });

    // 初回実行
    await runSync(clients);

    // 起動通知
    try {
      await clients.notificationService.sendTeamsNotification(
        'Garoon定期同期開始',
        `定期同期スケジューラーが開始されました\n同期間隔: ${intervalMinutes}分\n開始時刻: ${new Date().toLocaleString('ja-JP')}`,
        'default'
      );
    } catch (notifyError) {
      log.warn('Teams通知の送信に失敗しました', { error: notifyError });
    }

    // 定期実行スケジュール
    cron.schedule(
      cronExpression,
      async () => {
        try {
          await runSync(clients);
        } catch (error) {
          log.error('定期同期でエラーが発生しました', { error });
          try {
            await clients.notificationService.sendErrorNotification(
              '定期同期でエラーが発生しました',
              error instanceof Error ? error.message : String(error)
            );
          } catch (notifyError) {
            log.warn('Teams通知の送信に失敗しました', { error: notifyError });
          }
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Tokyo',
      }
    );

    log.info('定期同期スケジューラーが正常に起動しました');
  } catch (error) {
    log.error('スケジューラーの起動に失敗しました', { error });
    process.exit(1);
  }
}

// Ctrl+Cでの終了処理
process.on('SIGINT', async () => {
  log.info('定期同期スケジューラーを終了します');

  try {
    const config = loadConfig();
    const notificationService = new NotificationService(config.teams);
    await notificationService.sendTeamsNotification(
      'Garoon定期同期終了',
      `定期同期スケジューラーが終了されました\n終了時刻: ${new Date().toLocaleString('ja-JP')}`,
      'warning'
    );
  } catch (notifyError) {
    log.warn('Teams通知の送信に失敗しました', { error: notifyError });
  }

  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    log.error('致命的なエラーが発生しました', { error });
    process.exit(1);
  });
}
