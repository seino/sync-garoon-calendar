// GaroonからGoogleカレンダーへの同期テストスクリプト
// デバッグ情報を表示しつつ同期を実行する

import { GaroonClient } from '../common/garoon';
import { GoogleCalendarClient } from '../google/calendar';
import { loadConfig } from '../common/config';
import { syncEvents, formatDate } from '../google/sync';
import { addDays } from 'date-fns';

async function main() {
  try {
    console.log('========================================');
    console.log('Garoon → Google Calendar 同期テスト開始');
    console.log('========================================\n');

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
    console.log('1. 接続テスト');
    console.log('---------------');

    console.log('ガルーンAPIに接続中...');
    await garoonClient.testConnection();
    console.log('ガルーンAPI接続成功');

    console.log('Google Calendar APIに接続中...');
    const connected = await googleClient.testConnection();
    if (!connected) {
      throw new Error('Google Calendar API接続失敗');
    }
    console.log('Google Calendar API接続成功');

    // 2. データ取得プレビュー
    console.log('\n2. データ取得テスト');
    console.log('------------------');

    const today = new Date();
    const startDate = formatDate(today);
    const endDate = formatDate(addDays(today, days));
    console.log(`期間: ${startDate} ～ ${endDate} (${days}日間)`);

    console.log('\nガルーンからイベント取得中...');
    const garoonEvents = await garoonClient.getSchedule(startDate, endDate);
    console.log(`取得したガルーンイベント: ${garoonEvents.length}件`);

    if (garoonEvents.length > 0) {
      console.log('\n--- ガルーンイベント一覧 ---');
      garoonEvents.forEach((event, index) => {
        const startTime = new Date(event.start.dateTime).toLocaleString('ja-JP');
        const endTime = new Date(event.end.dateTime).toLocaleString('ja-JP');
        const isPrivate = event.visibilityType === 'PRIVATE';
        const displayTitle = event.eventMenu
          ? `${event.eventMenu}: ${event.subject}`
          : event.subject;

        console.log(`[${index + 1}] ${displayTitle} ${isPrivate ? '(非公開)' : ''}`);
        console.log(`     ID: ${event.id}`);
        console.log(`     期間: ${startTime} - ${endTime}`);
        if (event.location) console.log(`     場所: ${event.location}`);
        console.log(`     参加者: ${event.attendees.length}名`);
      });
    }

    if (testOnly) {
      console.log('\nテストモードのため、実際の同期は行いません');
      return;
    }

    // 3. 同期テスト実行
    console.log('\n3. 同期テスト実行');
    console.log('----------------');

    const result = await syncEvents({
      garoonClient,
      googleClient,
      days,
      excludePrivate: config.sync.excludePrivate,
    });

    console.log('\n========================================');
    console.log('同期テスト結果');
    console.log('========================================');
    console.log(`処理したイベント: ${result.total}件`);
    console.log(`  新規作成: ${result.created}件`);
    console.log(`  更新: ${result.updated}件`);
    console.log(`  スキップ: ${result.skipped}件`);
    console.log(`  エラー: ${result.errors}件`);

    if (result.errors > 0) {
      console.log('一部のイベントで同期エラーが発生しました');
    }
  } catch (error) {
    console.error('\nテスト実行中にエラーが発生しました:');
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error('\nスタックトレース:');
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
