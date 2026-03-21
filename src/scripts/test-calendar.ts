import { GoogleCalendarClient } from '../google/calendar';
import { GoogleEvent } from '../types/google';
import { loadConfig } from '../common/config';
import { logger } from '../common/logger';

const log = logger.child({ module: 'TestCalendar' });

async function main() {
  try {
    // コマンドライン引数から設定ファイルパスを取得（オプション）
    const configArg = process.argv.find((arg) => arg.startsWith('--config='));
    const configPath = configArg ? configArg.split('=')[1] : undefined;

    // 設定を読み込む
    const config = loadConfig(configPath);

    // カレンダーIDを設定から取得
    const calendarId = config.google.calendarId;

    // クライアントの初期化
    const client = new GoogleCalendarClient(config.google);

    // 既存のイベントを取得
    log.info('既存のイベントを取得中...');
    const existingEvents = await client.listEvents(
      new Date(Date.now()),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日後まで
    );

    // 既存のイベントを削除
    if (existingEvents.length > 0) {
      log.info('既存イベントを削除中', { count: existingEvents.length });
      for (const event of existingEvents) {
        if (event.id) {
          await client.deleteEvent(event.id);
          log.info('イベントを削除しました', { summary: event.summary });
        }
      }
    }

    // 終日イベントの作成
    log.info('終日イベントを作成中...');
    const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後
    const endDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3日後

    const event: GoogleEvent = {
      summary: '開発合宿',
      description:
        'チーム開発合宿\n\n場所：リモート\n\n持ち物：\n- ノートPC\n- 充電器\n- 飲み物',
      start: { date: startDate.toISOString().split('T')[0] },
      end: { date: endDate.toISOString().split('T')[0] },
      location: 'リモート',
      reminders: {
        useDefault: false,
        overrides: [
          {
            method: 'popup',
            minutes: 10,
          },
        ],
      },
    };

    const eventId = await client.createEvent(event);
    log.info('終日イベントを作成しました', { eventId });

    // イベントの更新
    log.info('イベントを更新中...');
    const updatedEvent: GoogleEvent = {
      summary: '【重要】開発合宿',
      description:
        'チーム開発合宿\n\n場所：リモート\n\n持ち物：\n- ノートPC\n- 充電器\n- 飲み物\n- スナック\n\n注意事項：\n- 9:00に集合\n- 18:00に解散',
      start: { date: startDate.toISOString().split('T')[0] },
      end: { date: endDate.toISOString().split('T')[0] },
      location: 'リモート (Zoom URL: https://zoom.us/j/123456789)',
      reminders: {
        useDefault: false,
        overrides: [
          {
            method: 'popup',
            minutes: 10,
          },
        ],
      },
    };

    await client.updateEvent(eventId, updatedEvent);
    log.info('イベントを更新しました');

    // イベントの一覧取得
    log.info('イベント一覧を取得中...');
    const events = await client.listEvents(
      new Date(Date.now()),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日後まで
    );
    log.info('イベント一覧取得完了', { count: events.length });

    // イベントの削除
    log.info('イベントを削除中...');
    await client.deleteEvent(eventId);
    log.info('イベントを削除しました');

    log.info('実行情報', {
      calendarId,
      credentialsPath: config.google.credentials,
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
