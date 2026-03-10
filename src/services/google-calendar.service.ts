import { GoogleCalendarEvent, GoogleCalendarEventsResponse } from '../models/google-calendar.model';
import { CalendarEventReference } from '../models';
import { AppError } from '../middleware/error-handler';

export class GoogleCalendarService {
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(private accessToken: string) {}

  async getTodayEvents(date: string, timezone: string): Promise<CalendarEventReference[]> {
    const params = new URLSearchParams({
      timeMin: `${date}T00:00:00`,
      timeMax: `${date}T23:59:59`,
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: timezone,
    });

    const response = await this.request<GoogleCalendarEventsResponse>(
      `/calendars/primary/events?${params.toString()}`
    );

    return response.items
      .filter((event) => event.status !== 'cancelled')
      .map((event) => this.mapEvent(event));
  }

  private mapEvent(event: GoogleCalendarEvent): CalendarEventReference {
    const isAllDay = !!event.start.date && !event.start.dateTime;

    return {
      eventId: event.id,
      title: event.summary || '(No title)',
      startTime: isAllDay
        ? new Date(event.start.date! + 'T00:00:00')
        : new Date(event.start.dateTime!),
      endTime: isAllDay
        ? new Date(event.end.date! + 'T00:00:00')
        : new Date(event.end.dateTime!),
      isAllDay,
    };
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new AppError(
        `Google Calendar API error: ${response.status} ${response.statusText}`,
        response.status >= 500 ? 502 : response.status
      );
    }

    return response.json() as Promise<T>;
  }
}
