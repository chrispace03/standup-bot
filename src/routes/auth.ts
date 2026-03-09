import { Router, Request, Response, NextFunction } from 'express';
import { WebClient } from '@slack/web-api';
import { config, getDb } from '../config';
import { AppError } from '../middleware';
import { UserService } from '../services/user.service';
import { TeamService } from '../services/team.service';
import { TokenService } from '../services/token.service';
import { JiraService } from '../services/jira.service';
import { buildJiraAuthUrl, exchangeJiraCode, getAccessibleResources } from '../utils/jira-auth.utils';

const router = Router();

const SLACK_SCOPES = ['chat:write', 'commands', 'users:read', 'channels:read'];

router.get('/slack', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: SLACK_SCOPES.join(','),
    redirect_uri: `${config.app.baseUrl}/auth/slack/callback`,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

router.get('/slack/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = req.query.code as string;
    if (!code) throw new AppError('Missing authorization code', 400);

    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      code,
      redirect_uri: `${config.app.baseUrl}/auth/slack/callback`,
    });

    if (!result.ok || !result.access_token) {
      throw new AppError('Slack OAuth failed', 502);
    }

    const db = getDb();
    const userService = new UserService(db);
    const teamService = new TeamService(db);
    const tokenService = new TokenService(db, config.app.encryptionKey);

    const slackUserId = result.authed_user?.id;
    const teamId = result.team?.id;
    const teamName = result.team?.name;
    const botToken = result.access_token;

    if (!slackUserId || !teamId) {
      throw new AppError('Invalid OAuth response from Slack', 502);
    }

    // Create or update user
    const existingUser = await userService.getBySlackId(slackUserId);
    if (!existingUser) {
      await userService.create({
        slackUserId,
        slackTeamId: teamId,
        displayName: slackUserId,
        email: '',
        timezone: 'UTC',
        standupTime: '09:00',
        standupEnabled: true,
        standupDays: [1, 2, 3, 4, 5],
        googleConnected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Create or update team
    const existingTeam = await teamService.getBySlackTeamId(teamId);
    if (!existingTeam) {
      await teamService.create({
        slackTeamId: teamId,
        teamName: teamName || teamId,
        installedBy: slackUserId,
        installedAt: new Date(),
        settings: {
          standupDays: [1, 2, 3, 4, 5],
          reminderEnabled: true,
        },
      });
    }

    // Save encrypted bot token
    await tokenService.saveSlackTokens(slackUserId, {
      accessToken: botToken,
      refreshToken: result.refresh_token || '',
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours default
      scope: result.scope || SLACK_SCOPES.join(','),
    });

    res.send('<html><body><h1>Slack connected!</h1><p>You can close this window.</p></body></html>');
  } catch (err) {
    next(err);
  }
});

// --- Jira OAuth 2.0 (3LO) ---

router.get('/jira', (req: Request, res: Response, next: NextFunction) => {
  try {
    const slackUserId = req.query.slackUserId as string;
    if (!slackUserId) throw new AppError('slackUserId query parameter is required', 400);

    // TODO: Use signed state parameter in production (CSRF protection)
    const authUrl = buildJiraAuthUrl(config.jira.clientId, config.jira.redirectUri, slackUserId);
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

router.get('/jira/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = req.query.code as string;
    const slackUserId = req.query.state as string;
    if (!code) throw new AppError('Missing authorization code', 400);
    if (!slackUserId) throw new AppError('Missing state parameter', 400);

    // Exchange code for tokens
    const tokenResponse = await exchangeJiraCode(
      code,
      config.jira.clientId,
      config.jira.clientSecret,
      config.jira.redirectUri
    );

    // Get cloud ID and site URL
    const resources = await getAccessibleResources(tokenResponse.access_token);
    if (resources.length === 0) {
      throw new AppError('No Jira sites found for this account', 400);
    }
    const { id: cloudId, url: siteUrl } = resources[0];

    const db = getDb();
    const userService = new UserService(db);
    const tokenService = new TokenService(db, config.app.encryptionKey);

    // Save encrypted Jira tokens
    await tokenService.saveJiraTokens(slackUserId, {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
      scope: tokenResponse.scope,
      cloudId,
      siteUrl,
    });

    // Fetch Jira user info and update user record
    const jiraService = new JiraService(tokenResponse.access_token, cloudId, siteUrl);
    const jiraUser = await jiraService.getCurrentUser();
    await userService.update(slackUserId, { jiraAccountId: jiraUser.accountId });

    res.send('<html><body><h1>Jira connected!</h1><p>You can close this window.</p></body></html>');
  } catch (err) {
    next(err);
  }
});

export default router;
