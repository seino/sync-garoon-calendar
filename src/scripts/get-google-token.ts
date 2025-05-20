import { google } from 'googleapis';
import readline from 'readline';
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';

if (!clientId || !clientSecret) {
  console.error('環境変数 GOOGLE_CLIENT_ID または GOOGLE_CLIENT_SECRET が設定されていません');
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'  // 毎回同意画面を表示
});

console.log('このURLにアクセスして認可コードを取得してください:\n', authUrl);
console.log('\n認可コードを取得したら、コピーして貼り付けてください。');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('認可コードを入力してください: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('\n取得したトークン情報:');
    console.log(JSON.stringify(tokens, null, 2));

    // google-credentials.jsonの形式で出力
    const credentials = {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri],
      refresh_token: tokens.refresh_token
    };

    console.log('\ncredentials/google-credentials.jsonとして保存する内容:');
    console.log(JSON.stringify(credentials, null, 2));
  } catch (error) {
    console.error('トークンの取得に失敗しました:', error);
    process.exit(1);
  }
});
