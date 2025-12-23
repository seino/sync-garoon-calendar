// 同期データの永続化（JSONファイル）

import fs from 'fs';
import path from 'path';
import { AppConfig } from '../types/config';

export interface SyncLogEntry {
  id: number;
  timestamp: string;
  action: string;
  garoon_event_id: string | null;
  google_event_id: string | null;
  details: string | null;
}

export interface SyncedEventInfo {
  garoonEventId: string;
  googleEventId: string;
  lastSynced: string;
  garoonUpdatedAt: string;
}

interface SyncData {
  events: Record<string, SyncedEventInfo>;
  logs: SyncLogEntry[];
  lastLogId: number;
}

export class SyncDatabase {
  private dataPath: string;
  private data: SyncData;

  constructor(config: AppConfig) {
    this.dataPath = config.database.path.replace(/\.db$/, '.json');

    const dataDir = path.dirname(this.dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.data = this.loadData();
  }

  private loadData(): SyncData {
    if (fs.existsSync(this.dataPath)) {
      try {
        const content = fs.readFileSync(this.dataPath, 'utf8');
        return JSON.parse(content);
      } catch {
        console.warn('データファイルの読み込みに失敗しました。新規作成します。');
      }
    }
    return { events: {}, logs: [], lastLogId: 0 };
  }

  private saveData(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  /**
   * イベントの同期情報を取得
   * @param garoonEventId ガルーンイベントID
   * @returns 同期情報（存在しない場合はnull）
   */
  getSyncInfo(garoonEventId: string): {
    googleEventId: string;
    lastSynced: string;
    garoonUpdatedAt: string;
  } | null {
    const event = this.data.events[garoonEventId];
    if (!event) {
      return null;
    }
    return {
      googleEventId: event.googleEventId,
      lastSynced: event.lastSynced,
      garoonUpdatedAt: event.garoonUpdatedAt,
    };
  }

  /**
   * 同期情報を保存/更新
   * @param garoonEventId ガルーンイベントID
   * @param googleEventId GoogleイベントID
   * @param garoonUpdatedAt ガルーンの最終更新日時
   */
  saveSyncInfo(
    garoonEventId: string,
    googleEventId: string,
    garoonUpdatedAt: string
  ): void {
    this.data.events[garoonEventId] = {
      garoonEventId,
      googleEventId,
      lastSynced: new Date().toISOString(),
      garoonUpdatedAt,
    };
    this.saveData();
  }

  /**
   * 同期情報を削除
   * @param garoonEventId ガルーンイベントID
   */
  deleteSyncInfo(garoonEventId: string): void {
    delete this.data.events[garoonEventId];
    this.saveData();
  }

  /**
   * GoogleイベントIDで同期情報を削除
   * @param googleEventId GoogleイベントID
   */
  deleteSyncInfoByGoogleEventId(googleEventId: string): void {
    for (const [garoonId, event] of Object.entries(this.data.events)) {
      if (event.googleEventId === googleEventId) {
        delete this.data.events[garoonId];
        break;
      }
    }
    this.saveData();
  }

  /**
   * 全ての同期済みイベント情報を取得
   * @returns 同期済みイベント情報の配列
   */
  getAllSyncedEvents(): SyncedEventInfo[] {
    return Object.values(this.data.events);
  }

  /**
   * 同期ログを記録
   * @param action 実行したアクション
   * @param garoonEventId ガルーンイベントID（任意）
   * @param googleEventId GoogleイベントID（任意）
   * @param details 詳細情報（任意）
   */
  logSync(
    action: string,
    garoonEventId?: string,
    googleEventId?: string,
    details?: string
  ): void {
    this.data.lastLogId++;
    this.data.logs.push({
      id: this.data.lastLogId,
      timestamp: new Date().toISOString(),
      action,
      garoon_event_id: garoonEventId || null,
      google_event_id: googleEventId || null,
      details: details || null,
    });

    // ログが1000件を超えたら古いものを削除
    if (this.data.logs.length > 1000) {
      this.data.logs = this.data.logs.slice(-500);
    }

    this.saveData();
  }

  /**
   * 最近の同期ログを取得
   * @param limit 取得する件数
   * @returns 同期ログの配列
   */
  getRecentLogs(limit: number = 100): SyncLogEntry[] {
    return this.data.logs.slice(-limit).reverse();
  }

  /**
   * 古い同期情報を削除（数日前より古いものを削除）
   * @param daysToKeep 保持する日数
   */
  cleanupOldSyncInfo(daysToKeep: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString();

    for (const [garoonId, event] of Object.entries(this.data.events)) {
      if (event.lastSynced < cutoffStr) {
        delete this.data.events[garoonId];
      }
    }
    this.saveData();
  }
}
