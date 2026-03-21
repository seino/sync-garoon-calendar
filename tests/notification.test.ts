import { NotificationService } from '../src/common/notification';

// axios をモック
jest.mock('axios', () => ({
  post: jest.fn(),
}));

import axios from 'axios';

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendTeamsNotification', () => {
    it('webhookURLが設定されていない場合はfalseを返す', async () => {
      const service = new NotificationService({ webhookUrl: '', notifyOnError: true });
      const result = await service.sendTeamsNotification('タイトル', 'メッセージ');

      expect(result).toBe(false);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('webhookURLが設定されている場合はPOSTして true を返す', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      const service = new NotificationService({
        webhookUrl: 'https://webhook.example.com',
        notifyOnError: true,
      });

      const result = await service.sendTeamsNotification('タイトル', 'メッセージ');

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://webhook.example.com',
        expect.objectContaining({
          type: 'message',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              contentType: 'application/vnd.microsoft.card.adaptive',
            }),
          ]),
        })
      );
    });

    it('successカラーで送信できる', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      const service = new NotificationService({
        webhookUrl: 'https://webhook.example.com',
        notifyOnError: true,
      });

      const result = await service.sendTeamsNotification('成功', 'メッセージ', 'success');
      expect(result).toBe(true);
    });

    it('API呼び出しが失敗した場合はfalseを返す', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('Network error'));
      const service = new NotificationService({
        webhookUrl: 'https://webhook.example.com',
        notifyOnError: true,
      });

      const result = await service.sendTeamsNotification('タイトル', 'メッセージ');
      expect(result).toBe(false);
    });
  });

  describe('sendErrorNotification', () => {
    it('Errorオブジェクトのメッセージを送信する', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      const service = new NotificationService({
        webhookUrl: 'https://webhook.example.com',
        notifyOnError: true,
      });

      const result = await service.sendErrorNotification('テストエラー', new Error('詳細メッセージ'));
      expect(result).toBe(true);
    });

    it('文字列のエラーメッセージを送信する', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      const service = new NotificationService({
        webhookUrl: 'https://webhook.example.com',
        notifyOnError: true,
      });

      const result = await service.sendErrorNotification('テストエラー', 'エラー文字列');
      expect(result).toBe(true);
    });
  });

  describe('sendSyncResultNotification', () => {
    it('変更がある場合はsuccessカラーで送信する', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      const service = new NotificationService({
        webhookUrl: 'https://webhook.example.com',
        notifyOnError: true,
      });

      const result = await service.sendSyncResultNotification(5, 3, 1, 0);
      expect(result).toBe(true);
    });

    it('エラーがある場合はerrorカラーで送信する', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      const service = new NotificationService({
        webhookUrl: 'https://webhook.example.com',
        notifyOnError: true,
      });

      const result = await service.sendSyncResultNotification(5, 3, 0, 2);
      expect(result).toBe(true);
    });

    it('変更なしの場合はdefaultカラーで送信する', async () => {
      (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
      const service = new NotificationService({
        webhookUrl: 'https://webhook.example.com',
        notifyOnError: true,
      });

      const result = await service.sendSyncResultNotification(0, 0, 0, 0);
      expect(result).toBe(true);
    });
  });
});
