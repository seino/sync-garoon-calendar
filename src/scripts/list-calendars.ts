import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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
      console.log('利用可能なカレンダーが見つかりませんでした。');
      return;
    }

    console.log('利用可能なカレンダー一覧:');
    calendars.forEach((cal, index) => {
      console.log(`${index + 1}. ${cal.summary} (ID: ${cal.id})`);
      if (cal.description) {
        console.log(`   説明: ${cal.description}`);
      }
      console.log(`   アクセス権限: ${cal.accessRole}`);
      console.log('---');
    });

  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
