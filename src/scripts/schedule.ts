// ガルーン → Google Calendar 定期同期スクリプト

import cron from 'node-cron';
import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from '../google/calendar';
import { NotificationService } from '../common/notification';
import { loadConfig } from '../common/config';
import { syncEvents } from '../google/sync';

async function runSync(): Promise<void> {
  console.log('\n========================================');
  console.log('定期同期開始');
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}`);
  console.log('========================================');

  const config = loadConfig();
  const garoonClient = new GaroonClient(config.garoon);
  const googleClient = new GoogleCalendarClient(config.google);
  const notificationService = new NotificationService(config.teams);

  const result = await syncEvents({
    garoonClient,
    googleClient,
    days: 7,
    excludePrivate: config.sync.excludePrivate,
  });

  console.log(`\n同期完了: 作成=${result.created}件, 更新=${result.updated}件, スキップ=${result.skipped}件, エラー=${result.errors}件`);
  console.log(`完了時刻: ${new Date().toLocaleString('ja-JP')}`);

  try {
    await notificationService.sendSyncResultNotification(
      result.created,
      result.updated,
      0,
      result.errors
    );
  } catch (notifyError) {
    console.warn('[Teams] 通知の送信に失敗しました:', notifyError);
  }
}

async function main(): Promise<void> {
  console.log('ガルーン → Google Calendar 定期同期スケジューラーを起動します...');

  try {
    const config = loadConfig();
    const notificationService = new NotificationService(config.teams);

    const intervalMinutes = config.sync.intervalMinutes || 15;
    const cronExpression = `*/${intervalMinutes} * * * *`;

    console.log(`定期実行間隔: ${intervalMinutes}分`);
    console.log('定期同期を開始します...\n');

    // 初回実行
    await runSync();

    // 起動通知
    try {
      await notificationService.sendTeamsNotification(
        'Garoon定期同期開始',
        `定期同期スケジューラーが開始されました\n同期間隔: ${intervalMinutes}分\n開始時刻: ${new Date().toLocaleString('ja-JP')}`,
        'default'
      );
    } catch (notifyError) {
      console.warn('[Teams] 通知の送信に失敗しました:', notifyError);
    }

    // 定期実行スケジュール
    cron.schedule(
      cronExpression,
      async () => {
        try {
          await runSync();
        } catch (error) {
          console.error('[Scheduler] 定期同期でエラーが発生しました:', error);
          try {
            await notificationService.sendErrorNotification(
              '定期同期でエラーが発生しました',
              error instanceof Error ? error.message : String(error)
            );
          } catch (notifyError) {
            console.warn('[Teams] 通知の送信に失敗しました:', notifyError);
          }
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Tokyo',
      }
    );

    console.log('\n定期同期スケジューラーが正常に起動しました。');
    console.log('プロセスを停止するには Ctrl+C を押してください。');
  } catch (error) {
    console.error('[Scheduler] スケジューラーの起動に失敗しました:', error);
    process.exit(1);
  }
}

// Ctrl+Cでの終了処理
process.on('SIGINT', async () => {
  console.log('\n定期同期スケジューラーを終了します...');

  try {
    const config = loadConfig();
    const notificationService = new NotificationService(config.teams);
    await notificationService.sendTeamsNotification(
      'Garoon定期同期終了',
      `定期同期スケジューラーが終了されました\n終了時刻: ${new Date().toLocaleString('ja-JP')}`,
      'warning'
    );
  } catch (notifyError) {
    console.warn('[Teams] 通知の送信に失敗しました:', notifyError);
  }

  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error('[Scheduler] 致命的なエラーが発生しました:', error);
    process.exit(1);
  });
}
