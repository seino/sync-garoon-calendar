// 設定関連の型定義

import { GaroonAuthConfig } from './garoon';
import { GoogleCalendarConfig } from './google';

export interface TeamsConfig {
  webhookUrl: string;
  notifyOnError: boolean;
}

export interface DatabaseConfig {
  path: string;
}

export interface SyncConfig {
  days: number;
  excludePrivate: boolean;
  intervalMinutes?: number;
  defaultTimeZone?: string;
}

export interface AppConfig {
  garoon: GaroonAuthConfig;
  google: GoogleCalendarConfig;
  sync: SyncConfig;
  teams: TeamsConfig;
  database: DatabaseConfig;
}
