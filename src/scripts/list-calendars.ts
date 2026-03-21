import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from '../common/logger';

const log = logger.child({ module: 'ListCalendars' });

// .envファイルを読み込む
dotenv.config();

async function main() {
  try {
    // 認証情報の読み込み
    const credentialsPath = path.resolve(process.cwd(), 'credentials/google-credentials.json');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    // OAuth2クライアントの初期化
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uris[0]
    );

    oauth2Client.setCredentials({
      refresh_token: credentials.refresh_token
    });

    // カレンダーAPIの初期化
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // カレンダー一覧の取得
    const response = await calendar.calendarList.list();
    const calendars = response.data.items;

    if (!calendars || calendars.length === 0) {
      log.info('利用可能なカレンダーが見つかりませんでした');
      return;
    }

    log.info('カレンダー一覧取得完了', { count: calendars.length });
    calendars.forEach((cal, index) => {
      log.info(`${index + 1}. ${cal.summary}`, {
        id: cal.id,
        description: cal.description || undefined,
        accessRole: cal.accessRole,
      });
    });

  } catch (error) {
    log.error('エラーが発生しました', { error });
    process.exit(1);
  }
}

main();
