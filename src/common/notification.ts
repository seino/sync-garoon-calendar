// 通知機能

import { IncomingWebhook } from 'ms-teams-webhook';
import { TeamsConfig } from '../types/config';

export class NotificationService {
  private teamsWebhook: IncomingWebhook | null = null;

  constructor(config: TeamsConfig) {
    if (config.webhookUrl) {
      this.teamsWebhook = new IncomingWebhook(config.webhookUrl);
    }
  }

  /**
   * Microsoft Teamsに通知を送信
   * @param title タイトル
   * @param message メッセージ本文
   * @param color カラー（デフォルトは情報）
   * @returns 送信成功したかどうか
   */
  async sendTeamsNotification(
    title: string,
    message: string,
    color: 'default' | 'success' | 'warning' | 'error' = 'default'
  ): Promise<boolean> {
    if (!this.teamsWebhook) {
      console.log(
        'Microsoft Teamsの通知設定がないため、通知はスキップされました'
      );
      return false;
    }

    try {
      // カラーコードの設定
      let themeColor: string;
      switch (color) {
        case 'success':
          themeColor = '0x2D8C3C'; // 緑
          break;
        case 'warning':
          themeColor = '0xF2C811'; // 黄
          break;
        case 'error':
          themeColor = '0xC4314B'; // 赤
          break;
        default:
          themeColor = '0x6264A7'; // Microsoft Teams青
      }

      const timestamp = new Date().toLocaleString('ja-JP');

      // メッセージカードの作成
      const card = {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              type: 'AdaptiveCard',
              version: '1.0',
              themeColor,
              body: [
                {
                  type: 'TextBlock',
                  size: 'medium',
                  weight: 'bolder',
                  text: title,
                },
                {
                  type: 'TextBlock',
                  text: message,
                  wrap: true,
                },
                {
                  type: 'TextBlock',
                  size: 'small',
                  text: `送信時刻: ${timestamp}`,
                  isSubtle: true,
                },
              ],
            },
          },
        ],
      };

      // 送信
      await this.teamsWebhook.send(card);
      return true;
    } catch (error) {
      console.error('Microsoft Teams通知エラー:', error);
      return false;
    }
  }

  /**
   * エラー通知を送信
   * @param title タイトル
   * @param error エラーオブジェクトまたはメッセージ
   * @returns 送信成功したかどうか
   */
  async sendErrorNotification(
    title: string,
    error: Error | string
  ): Promise<boolean> {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.sendTeamsNotification(
      `エラー: ${title}`,
      errorMessage,
      'error'
    );
  }

  /**
   * 同期結果の通知を送信
   * @param added 追加された件数
   * @param updated 更新された件数
   * @param deleted 削除された件数
   * @param errors エラーの件数
   * @returns 送信成功したかどうか
   */
  async sendSyncResultNotification(
    added: number,
    updated: number,
    deleted: number,
    errors: number
  ): Promise<boolean> {
    const total = added + updated + deleted;

    let title = 'ガルーン同期結果';
    let color: 'default' | 'success' | 'warning' | 'error' = 'default';

    if (errors > 0) {
      title = `${title} (エラーあり)`;
      color = 'error';
    } else if (total === 0) {
      title = `${title} (変更なし)`;
    } else {
      title = `${title} (成功)`;
      color = 'success';
    }

    const message = `
追加: ${added}件
更新: ${updated}件
削除: ${deleted}件
${errors > 0 ? `エラー: ${errors}件` : ''}
合計: ${total}件の同期が完了しました
    `.trim();

    return this.sendTeamsNotification(title, message, color);
  }
}
