import { GoogleCalendarClient } from '../src/google/calendar';
import { GoogleCalendarConfig } from '../src/types/google';

describe('GoogleCalendarClient', () => {
  describe('constructor', () => {
    it('throws error when credentials file does not exist', () => {
      const config: GoogleCalendarConfig = {
        calendarId: 'primary',
        credentials: 'non-existent-file.json',
      };

      expect(() => new GoogleCalendarClient(config)).toThrow(
        /non-existent-file\.json/
      );
    });
  });
});
