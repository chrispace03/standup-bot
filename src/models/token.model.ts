export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string;
}

export interface UserTokens {
  slackUserId: string;
  slack?: TokenSet;
  jira?: TokenSet & { cloudId: string; siteUrl: string };
  google?: TokenSet;
  updatedAt: Date;
}
