// GaroonからGoogleカレンダーへの同期（本番用）

import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from '../google/calendar';
import { NotificationService } from '../common/notification';
import { loadConfig } from '../common/config';
import { syncEvents } from '../google/sync';

async function main() {
  try {
    console.log('========================================');
    console.log('Garoon → Google Calendar 同期開始');
    console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}`);
    console.log('========================================\n');

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
    console.log('接続確認中...');
    await garoonClient.testConnection();
    const googleConnected = await googleClient.testConnection();
    if (!googleConnected) {
      throw new Error('Google Calendar APIへの接続に失敗しました');
    }
    console.log('接続確認完了\n');

    // 同期実行
    const result = await syncEvents({
      garoonClient,
      googleClient,
      days,
      excludePrivate: config.sync.excludePrivate,
      dryRun,
    });

    if (dryRun) {
      console.log('\nドライランモードのため、実際の同期は行いませんでした');
      return;
    }

    // 結果表示
    console.log('\n========================================');
    console.log('同期完了');
    console.log('========================================');
    console.log(`処理したイベント: ${result.total}件`);
    console.log(`  新規作成: ${result.created}件`);
    console.log(`  更新: ${result.updated}件`);
    console.log(`  スキップ: ${result.skipped}件`);
    console.log(`  エラー: ${result.errors}件`);
    console.log(`完了時刻: ${new Date().toLocaleString('ja-JP')}`);

    // Teams通知
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

    if (result.errors > 0) {
      console.log('一部のイベントで同期エラーが発生しました');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n同期処理中にエラーが発生しました:');
    console.error(error instanceof Error ? error.message : error);

    try {
      const config = loadConfig();
      const notificationService = new NotificationService(config.teams);
      await notificationService.sendErrorNotification(
        '同期処理で致命的なエラーが発生しました',
        error instanceof Error ? error.message : String(error)
      );
    } catch (notifyError) {
      console.warn('[Teams] 通知の送信に失敗しました:', notifyError);
    }

    process.exit(1);
  }
}

main();
