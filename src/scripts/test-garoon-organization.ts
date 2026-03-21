// ガルーンのスケジュール情報を組織IDで取得するテスト

import { GaroonClient } from '../common/garoon';
import { loadConfig } from '../common/config';
import { format, addDays } from 'date-fns';
import { logger } from '../common/logger';

const log = logger.child({ module: 'TestGaroonOrg' });

/**
 * 日付を YYYY-MM-DD 形式にフォーマット
 * @param date 日付
 */
function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

async function main() {
  try {
    // コマンドライン引数からの取得
    const configArg = process.argv.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;

    // 日数指定の取得（デフォルト: 7）
    const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
    const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;

    // 組織ID指定の取得
    const orgIdArg = process.argv.find((arg) => arg.startsWith('--orgId='));
    const organizationId = orgIdArg ? orgIdArg.split('=')[1] : '4'; // デフォルトの組織ID

    // 設定を読み込む
    const config = loadConfig(configPath);

    // 組織IDで上書き
    config.garoon.targetType = 'organization';
    config.garoon.targetId = organizationId;

    // ガルーンクライアントの初期化
    const client = new GaroonClient({
      baseUrl: config.garoon.baseUrl,
      apiToken: config.garoon.apiToken,
      username: config.garoon.username,
      password: config.garoon.password,
      targetType: config.garoon.targetType,
      targetId: config.garoon.targetId,
    });

    log.info('ガルーンAPIに接続しています', {
      baseUrl: config.garoon.baseUrl,
      authMethod: config.garoon.apiToken ? 'APIトークン' : 'ユーザー名/パスワード',
      targetType: '組織',
      targetId: config.garoon.targetId,
    });

    // 接続テスト
    try {
      const isConnected = await client.testConnection();
      if (!isConnected) {
        throw new Error(
          'ガルーンAPIへの接続に失敗しました。認証情報を確認してください。'
        );
      }
      log.info('ガルーンAPIに接続成功しました');
    } catch (error) {
      log.error('ガルーンAPIへの接続に失敗しました', { error });
      throw error;
    }

    // 取得する期間を設定
    const today = new Date();
    const startDate = formatDate(today);
    const endDate = formatDate(addDays(today, days));

    log.info('組織の予定を取得します', { startDate, endDate, days });

    // スケジュール取得
    const events = await client.getSchedule(startDate, endDate);

    // 結果の表示
    log.info('予定取得完了', { count: events.length });

    if (events.length === 0) {
      log.info('この期間に予定はありません');
    } else {
      events.forEach((event, index) => {
        const startTime = new Date(event.start.dateTime).toLocaleString('ja-JP');
        const endTime = new Date(event.end.dateTime).toLocaleString('ja-JP');

        log.info(`[${index + 1}] ${event.subject}`, {
          id: event.id,
          startTime,
          endTime,
          isAllDay: event.isAllDay,
          location: event.location || undefined,
          notes: event.notes ? event.notes.substring(0, 100) : undefined,
          attendees: event.attendees.map((a) => a.name).join(', ') || 'なし',
          isPrivate: event.visibilityType === 'PRIVATE',
          updatedAt: new Date(event.updatedAt).toLocaleString('ja-JP'),
        });
      });
    }

    log.info('実行情報', {
      baseUrl: config.garoon.baseUrl,
      authMethod: config.garoon.apiToken ? 'APIトークン' : 'ユーザー名/パスワード',
      targetType: '組織',
      targetId: config.garoon.targetId,
      days,
      startDate,
      endDate,
    });
  } catch (error) {
    log.error('エラーが発生しました', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

main();
