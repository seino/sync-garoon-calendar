// ガルーンのスケジュール情報を取得するテスト

import { GaroonClient } from '../common/garoon';
import { loadConfig } from '../common/config';
import { format, addDays } from 'date-fns';

/**
 * 日付を YYYY-MM-DD 形式にフォーマット
 * @param date 日付
 */
function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

async function main() {
  try {
    // コマンドライン引数から設定ファイルパスを取得（オプション）
    const configArg = process.argv.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;

    // 日数指定の取得（デフォルト: 7）
    const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
    const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;

    // 設定を読み込む
    const config = loadConfig(configPath);

    // ガルーンクライアントの初期化
    const client = new GaroonClient({
      baseUrl: config.garoon.baseUrl,
      apiToken: config.garoon.apiToken,
      username: config.garoon.username,
      password: config.garoon.password,
    });

    console.log('ガルーンAPIに接続しています...');
    console.log('接続設定:');
    console.log(`- ベースURL: ${config.garoon.baseUrl}`);
    console.log(
      `- 認証方法: ${
        config.garoon.apiToken ? 'APIトークン' : 'ユーザー名/パスワード'
      }`
    );
    console.log(
      `- ターゲット: ${
        config.garoon.targetType === 'organization' ? '組織' : 'ユーザー'
      } (ID: ${config.garoon.targetId})`
    );

    // 接続テスト
    try {
      // 接続テスト
      const isConnected = await client.testConnection();
      if (!isConnected) {
        throw new Error(
          'ガルーンAPIへの接続に失敗しました。認証情報を確認してください。'
        );
      }

      console.log('✅ ガルーンAPIに接続成功しました');
    } catch (error) {
      console.error('❌ ガルーンAPIへの接続に失敗しました');
      throw error;
    }

    // 取得する期間を設定
    const today = new Date();
    const startDate = formatDate(today);
    const endDate = formatDate(addDays(today, days));

    console.log(
      `\n${startDate}から${endDate}までの予定を取得します（${days}日間）...`
    );

    // スケジュール取得
    const events = await client.getSchedule(startDate, endDate);

    // 結果の表示
    console.log(`\n取得した予定: ${events.length}件\n`);

    if (events.length === 0) {
      console.log('この期間に予定はありません。');
    } else {
      console.log('============ 予定一覧 ============');
      events.forEach((event, index) => {
        const startTime = new Date(event.start.dateTime).toLocaleString(
          'ja-JP'
        );
        const endTime = new Date(event.end.dateTime).toLocaleString('ja-JP');
        const isPrivate = event.visibilityType === 'PRIVATE';

        console.log(`[${index + 1}] ${event.subject} ${isPrivate ? '🔒' : ''}`);
        console.log(`  ID: ${event.id}`);
        console.log(`  期間: ${startTime} - ${endTime}`);
        console.log(`  終日: ${event.isAllDay ? 'はい' : 'いいえ'}`);
        if (event.location) console.log(`  場所: ${event.location}`);
        if (event.notes)
          console.log(
            `  メモ: ${event.notes.substring(0, 100)}${
              event.notes.length > 100 ? '...' : ''
            }`
          );
        console.log(
          `  参加者: ${event.attendees.map((a) => a.name).join(', ') || 'なし'}`
        );
        console.log(
          `  更新日時: ${new Date(event.updatedAt).toLocaleString('ja-JP')}`
        );
        console.log('-----------------------------------');
      });
    }

    console.log('\n========== 実行情報 ==========');
    console.log(`接続先: ${config.garoon.baseUrl}`);
    console.log(
      `認証方法: ${
        config.garoon.apiToken ? 'APIトークン' : 'ユーザー名/パスワード'
      }`
    );
    console.log(
      `ターゲット: ${
        config.garoon.targetType === 'organization' ? '組織' : 'ユーザー'
      } (ID: ${config.garoon.targetId})`
    );
    console.log(`取得期間: ${days}日間 (${startDate} - ${endDate})`);
    console.log('==============================');
  } catch (error) {
    console.error('エラーが発生しました:');
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
