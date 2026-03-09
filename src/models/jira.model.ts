export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
}

export interface JiraApiIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
  };
}

export interface JiraSearchResponse {
  issues: JiraApiIssue[];
  total: number;
  maxResults: number;
}

export interface JiraTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export interface JiraCloudResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
}
