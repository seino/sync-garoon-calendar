// ガルーンイベント関連の型定義

export interface GaroonEvent {
  id: string;
  eventMenu?: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay: boolean;
  notes?: string;
  attendees: GaroonAttendee[];
  visibilityType: string;
  eventType: 'REGULAR' | 'REPEATING' | 'ALL_DAY';
  updatedAt: string;
  createdAt: string;
  location?: string;
}

export interface GaroonAttendee {
  id: string;
  type: 'USER' | 'ORGANIZATION' | 'FACILITY';
  name: string;
}

export interface GaroonScheduleResponse {
  events: GaroonEvent[];
  hasNext: boolean;
  nextEventId?: string;
}

export interface GaroonAuthConfig {
  baseUrl: string;
  apiToken?: string;
  username?: string;
  password?: string;
  targetId?: string;
  targetType?: 'user' | 'organization';
}
