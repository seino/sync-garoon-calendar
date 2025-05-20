export interface CalendarEvent {
  id?: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  location: string;
  isAllDay?: boolean;
  reminders?: {
    useDefault: boolean;
    overrides?: {
      method: 'email' | 'popup';
      minutes: number;
    }[];
  };
}
