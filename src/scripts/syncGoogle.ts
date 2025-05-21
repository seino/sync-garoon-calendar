// Googleカレンダー同期実行スクリプト

import { syncEvents } from '../google/sync';

/**
 * メイン関数
 */
async function main(): Promise<void> {
  console.log('ガルーン -> Google Calendar 同期を開始します...');

  try {
    // コマンドライン引数から設定ファイルパスを取得（旧システムとの後方互換性のため）
    // 注：新しいシステムでは.envファイルを使用することを推奨
    const configArg = process.argv.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;

    // 同期開始日引数
    const startDateArg = process.argv.find((arg) => arg.startsWith('--start='));
    const startDate = startDateArg ? startDateArg.split('=')[1] : undefined;

    // 同期終了日引数
    const endDateArg = process.argv.find((arg) => arg.startsWith('--end='));
    const endDate = endDateArg ? endDateArg.split('=')[1] : undefined;

    // 同期実行
    await syncEvents(configPath, startDate, endDate);

    console.log('同期が完了しました');
    process.exit(0);
  } catch (error) {
    console.error('同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// メイン関数を実行
main();
