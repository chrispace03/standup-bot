import { GoogleCalendarService } from '../src/services/google-calendar.service';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function mockJsonResponse(data: unknown, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

describe('GoogleCalendarService', () => {
  describe('getTodayEvents', () => {
    it('sends correct URL with timeMin, timeMax, timeZone params', async () => {
      mockJsonResponse({ items: [] });

      const service = new GoogleCalendarService('test-token');
      await service.getTodayEvents('2026-03-10', 'Australia/Sydney');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/calendars/primary/events');
      expect(calledUrl).toContain('timeMin=2026-03-10T00%3A00%3A00');
      expect(calledUrl).toContain('timeMax=2026-03-10T23%3A59%3A59');
      expect(calledUrl).toContain('singleEvents=true');
      expect(calledUrl).toContain('orderBy=startTime');
      expect(calledUrl).toContain('timeZone=Australia%2FSydney');
    });

    it('maps timed events correctly', async () => {
      mockJsonResponse({
        items: [
          {
            id: 'evt-1',
            summary: 'Team Standup',
            start: { dateTime: '2026-03-10T09:00:00+11:00' },
            end: { dateTime: '2026-03-10T09:15:00+11:00' },
            status: 'confirmed',
          },
        ],
      });

      const service = new GoogleCalendarService('test-token');
      const events = await service.getTodayEvents('2026-03-10', 'Australia/Sydney');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        eventId: 'evt-1',
        title: 'Team Standup',
        startTime: new Date('2026-03-10T09:00:00+11:00'),
        endTime: new Date('2026-03-10T09:15:00+11:00'),
        isAllDay: false,
      });
    });

    it('maps all-day events with isAllDay true', async () => {
      mockJsonResponse({
        items: [
          {
            id: 'evt-2',
            summary: 'Company Holiday',
            start: { date: '2026-03-10' },
            end: { date: '2026-03-11' },
            status: 'confirmed',
          },
        ],
      });

      const service = new GoogleCalendarService('test-token');
      const events = await service.getTodayEvents('2026-03-10', 'Australia/Sydney');

      expect(events).toHaveLength(1);
      expect(events[0].isAllDay).toBe(true);
      expect(events[0].title).toBe('Company Holiday');
    });

    it('filters out cancelled events', async () => {
      mockJsonResponse({
        items: [
          {
            id: 'evt-active',
            summary: 'Active Meeting',
            start: { dateTime: '2026-03-10T10:00:00Z' },
            end: { dateTime: '2026-03-10T11:00:00Z' },
            status: 'confirmed',
          },
          {
            id: 'evt-cancelled',
            summary: 'Cancelled Meeting',
            start: { dateTime: '2026-03-10T14:00:00Z' },
            end: { dateTime: '2026-03-10T15:00:00Z' },
            status: 'cancelled',
          },
        ],
      });

      const service = new GoogleCalendarService('test-token');
      const events = await service.getTodayEvents('2026-03-10', 'UTC');

      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBe('evt-active');
    });

    it('uses "(No title)" for events with missing summary', async () => {
      mockJsonResponse({
        items: [
          {
            id: 'evt-notitle',
            start: { dateTime: '2026-03-10T12:00:00Z' },
            end: { dateTime: '2026-03-10T13:00:00Z' },
          },
        ],
      });

      const service = new GoogleCalendarService('test-token');
      const events = await service.getTodayEvents('2026-03-10', 'UTC');

      expect(events[0].title).toBe('(No title)');
    });

    it('returns empty array when no events', async () => {
      mockJsonResponse({ items: [] });

      const service = new GoogleCalendarService('test-token');
      const events = await service.getTodayEvents('2026-03-10', 'UTC');

      expect(events).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws AppError on API errors', async () => {
      mockJsonResponse({ error: { message: 'Unauthorized' } }, 401);

      const service = new GoogleCalendarService('bad-token');
      await expect(service.getTodayEvents('2026-03-10', 'UTC')).rejects.toThrow('Google Calendar API error: 401');
    });
  });
});
