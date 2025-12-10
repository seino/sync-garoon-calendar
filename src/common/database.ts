// データベース操作

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
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

export class SyncDatabase {
  private db: Database.Database;

  constructor(config: AppConfig) {
    // データベースディレクトリが存在しない場合は作成
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // データベース接続
    this.db = new Database(config.database.path);

    // テーブル初期化
    this.initTables();
  }

  /**
   * 必要なテーブルを初期化
   */
  private initTables(): void {
    // 同期済みイベントテーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS synced_events (
        garoon_event_id TEXT PRIMARY KEY,
        google_event_id TEXT NOT NULL,
        last_synced TEXT NOT NULL,
        garoon_updated_at TEXT NOT NULL
      )
    `);

    // 同期ログテーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        garoon_event_id TEXT,
        google_event_id TEXT,
        details TEXT
      )
    `);
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
    const stmt = this.db.prepare(
      'SELECT google_event_id, last_synced, garoon_updated_at FROM synced_events WHERE garoon_event_id = ?'
    );
    const result = stmt.get(garoonEventId) as
      | {
          google_event_id: string;
          last_synced: string;
          garoon_updated_at: string;
        }
      | undefined;

    if (!result) {
      return null;
    }

    return {
      googleEventId: result.google_event_id,
      lastSynced: result.last_synced,
      garoonUpdatedAt: result.garoon_updated_at,
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
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO synced_events (garoon_event_id, google_event_id, last_synced, garoon_updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(garoon_event_id)
      DO UPDATE SET google_event_id = ?, last_synced = ?, garoon_updated_at = ?
    `);

    stmt.run(
      garoonEventId,
      googleEventId,
      now,
      garoonUpdatedAt,
      googleEventId,
      now,
      garoonUpdatedAt
    );
  }

  /**
   * 同期情報を削除
   * @param garoonEventId ガルーンイベントID
   */
  deleteSyncInfo(garoonEventId: string): void {
    const stmt = this.db.prepare(
      'DELETE FROM synced_events WHERE garoon_event_id = ?'
    );
    stmt.run(garoonEventId);
  }

  /**
   * 全ての同期済みイベント情報を取得
   * @returns 同期済みイベント情報の配列
   */
  getAllSyncedEvents(): SyncedEventInfo[] {
    const stmt = this.db.prepare(
      'SELECT garoon_event_id, google_event_id, last_synced, garoon_updated_at FROM synced_events'
    );
    const results = stmt.all() as {
      garoon_event_id: string;
      google_event_id: string;
      last_synced: string;
      garoon_updated_at: string;
    }[];

    return results.map((r) => ({
      garoonEventId: r.garoon_event_id,
      googleEventId: r.google_event_id,
      lastSynced: r.last_synced,
      garoonUpdatedAt: r.garoon_updated_at,
    }));
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
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sync_logs (timestamp, action, garoon_event_id, google_event_id, details)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      now,
      action,
      garoonEventId || null,
      googleEventId || null,
      details || null
    );
  }

  /**
   * 最近の同期ログを取得
   * @param limit 取得する件数
   * @returns 同期ログの配列
   */
  getRecentLogs(limit: number = 100): SyncLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_logs
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(limit) as SyncLogEntry[];
  }

  /**
   * 古い同期情報を削除（数日前より古いものを削除）
   * @param daysToKeep 保持する日数
   */
  cleanupOldSyncInfo(daysToKeep: number = 90): void {
    const date = new Date();
    date.setDate(date.getDate() - daysToKeep);
    const cutoffDate = date.toISOString();

    const stmt = this.db.prepare(
      'DELETE FROM synced_events WHERE last_synced < ?'
    );
    stmt.run(cutoffDate);
  }

  /**
   * データベース接続を閉じる
   */
  close(): void {
    this.db.close();
  }
}
