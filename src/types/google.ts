// Google Calendar関連の型定義

export interface GoogleEventTime {
  dateTime: string;
  timeZone: string;
}

export interface GoogleEventDate {
  date: string;
}

export interface GoogleAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  optional?: boolean;
}

export interface GoogleEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: GoogleEventTime | GoogleEventDate;
  end: GoogleEventTime | GoogleEventDate;
  attendees?: GoogleAttendee[];
  extendedProperties?: {
    private?: {
      garoonEventId?: string;
      garoonUpdatedAt?: string;
    };
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  reminders?: {
    useDefault: boolean;
    overrides?: {
      method: 'email' | 'popup';
      minutes: number;
    }[];
  };
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface GoogleCalendarConfig {
  calendarId: string;
  credentials: string;
  oauth?: GoogleOAuthConfig;
}
