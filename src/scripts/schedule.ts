// 定期実行スクリプト

import cron from 'node-cron';
import { syncEvents, createSyncService } from '../google/sync';
import { loadConfig } from '../common/config';

/**
 * メイン関数
 */
async function main(): Promise<void> {
  console.log('ガルーン -> Google Calendar 同期スケジューラーを起動します...');

  try {
    // コマンドライン引数から設定ファイルパスを取得（旧システムとの後方互換性のため）
    // 注：新しいシステムでは.envファイルを使用することを推奨
    const configArg = process.argv.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;

    // 設定を読み込む
    const config = loadConfig(configPath);

    // 接続テスト
    const syncService = createSyncService(configPath);
    const connections = await syncService.testConnections();

    if (!connections.garoon || !connections.google) {
      console.error('接続テストに失敗しました:');
      console.error(`- Garoon: ${connections.garoon ? '成功' : '失敗'}`);
      console.error(`- Google: ${connections.google ? '成功' : '失敗'}`);
      process.exit(1);
    }

    console.log('接続テストに成功しました');

    // 同期間隔の設定（デフォルトは15分）
    const intervalMinutes = config.sync.intervalMinutes || 15;
    const cronExpression = `*/${intervalMinutes} * * * *`;

    console.log(
      `同期スケジュール: ${cronExpression} (${intervalMinutes}分ごと)`
    );

    // 起動時に一度実行
    console.log('初回同期を実行します...');
    await syncEvents(configPath);

    // 定期実行の設定
    cron.schedule(cronExpression, async () => {
      console.log(`[${new Date().toLocaleString()}] 定期同期を実行します...`);
      try {
        await syncEvents(configPath);
      } catch (error) {
        console.error('定期同期中にエラーが発生しました:', error);
      }
    });

    console.log('スケジューラーが起動しました。Ctrl+Cで終了できます。');
  } catch (error) {
    console.error('スケジューラーの起動に失敗しました:', error);
    process.exit(1);
  }
}

// メイン関数を実行
main();
