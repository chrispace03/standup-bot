import { JiraUser, JiraApiIssue, JiraSearchResponse } from '../models/jira.model';
import { JiraIssueReference } from '../models';
import { AppError } from '../middleware/error-handler';

export class JiraService {
  private baseUrl: string;

  constructor(
    private accessToken: string,
    private cloudId: string,
    private siteUrl: string
  ) {
    this.baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
  }

  async getCurrentUser(): Promise<JiraUser> {
    return this.request<JiraUser>('/rest/api/3/myself');
  }

  async getRecentlyUpdatedIssues(accountId: string, since: string): Promise<JiraIssueReference[]> {
    const jql = `assignee = "${accountId}" AND updated >= "${since}" ORDER BY updated DESC`;
    const result = await this.request<JiraSearchResponse>(
      `/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,status,issuetype&maxResults=50`
    );
    return result.issues.map((issue) => this.mapIssue(issue));
  }

  async getCurrentSprintIssues(accountId: string): Promise<JiraIssueReference[]> {
    const jql = `assignee = "${accountId}" AND sprint in openSprints() AND statusCategory != Done ORDER BY priority DESC`;
    const result = await this.request<JiraSearchResponse>(
      `/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,status,issuetype&maxResults=50`
    );
    return result.issues.map((issue) => this.mapIssue(issue));
  }

  async getIssue(issueKey: string): Promise<JiraIssueReference> {
    const issue = await this.request<JiraApiIssue>(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,status,issuetype`
    );
    return this.mapIssue(issue);
  }

  private mapIssue(issue: JiraApiIssue): JiraIssueReference {
    return {
      issueKey: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      issueType: issue.fields.issuetype.name,
      url: `${this.siteUrl}/browse/${issue.key}`,
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new AppError(
        `Jira API error: ${response.status} ${response.statusText}`,
        response.status >= 500 ? 502 : response.status
      );
    }

    return response.json() as Promise<T>;
  }
}
