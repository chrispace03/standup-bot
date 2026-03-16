import { Router, Request, Response, NextFunction } from 'express';
import { config, getDb } from '../config';
import { HealthCheckResponse } from '../models';
import { AppError } from '../middleware';
import { UserService } from '../services/user.service';
import { StandupService } from '../services/standup.service';
import { TokenService } from '../services/token.service';
import { StandupGeneratorService } from '../services/standup-generator.service';
import { StandupSchedulerService } from '../services/standup-scheduler.service';
import { getSlackService } from '../services/slack.service';

const router = Router();

function getUserService(): UserService {
  try {
    return new UserService(getDb());
  } catch {
    throw new AppError('Database not available', 503);
  }
}

function getStandupService(): StandupService {
  try {
    return new StandupService(getDb());
  } catch {
    throw new AppError('Database not available', 503);
  }
}

router.get('/health', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.app.nodeEnv,
  };
  res.json(response);
});

router.get('/user/:slackId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slackId = req.params.slackId as string;
    const userService = getUserService();
    const user = await userService.getBySlackId(slackId);
    if (!user) throw new AppError('User not found', 404);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.put('/user/:slackId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slackId = req.params.slackId as string;
    const userService = getUserService();
    const existing = await userService.getBySlackId(slackId);
    if (existing) {
      await userService.update(slackId, req.body);
    } else {
      const now = new Date();
      await userService.create({
        slackUserId: slackId,
        slackTeamId: req.body.slackTeamId || '',
        displayName: req.body.displayName || slackId,
        email: req.body.email || '',
        timezone: req.body.timezone || 'UTC',
        standupTime: req.body.standupTime || '09:00',
        standupEnabled: req.body.standupEnabled ?? true,
        standupDays: req.body.standupDays || [1, 2, 3, 4, 5],
        googleConnected: false,
        createdAt: now,
        updatedAt: now,
        ...req.body,
      });
    }
    const updated = await userService.getBySlackId(slackId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/standup/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, channelId } = req.body;
    if (!userId) throw new AppError('userId is required', 400);

    const db = getDb();
    const userService = new UserService(db);
    const user = await userService.getBySlackId(userId);
    if (!user) throw new AppError('User not found', 404);

    const tokenService = new TokenService(db, config.app.encryptionKey);
    const standupService = new StandupService(db);
    const generatorService = new StandupGeneratorService(
      tokenService, standupService, userService, getSlackService(),
      config.jira, config.google,
    );

    const targetChannel = channelId || user.defaultChannelId;
    const result = await generatorService.generate(userId, targetChannel);

    res.json({
      triggered: true,
      userId,
      date: result.record.date,
      posted: result.posted,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/scheduler/tick', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDb();
    const userService = new UserService(db);
    const standupService = new StandupService(db);
    const tokenService = new TokenService(db, config.app.encryptionKey);
    const generatorService = new StandupGeneratorService(
      tokenService, standupService, userService, getSlackService(),
      config.jira, config.google,
    );
    const scheduler = new StandupSchedulerService(userService, standupService, generatorService);
    await scheduler.tick();
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

router.get('/standup/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) throw new AppError('userId query parameter is required', 400);
    const limit = parseInt(req.query.limit as string, 10) || 14;
    const standupService = getStandupService();
    const records = await standupService.getHistory(userId, limit);
    res.json({ records });
  } catch (err) {
    next(err);
  }
});

// Dashboard endpoints
router.get('/dashboard/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const userService = getUserService();
    const users = await userService.getAll();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const userService = getUserService();
    const standupService = getStandupService();

    const users = await userService.getAll();
    const recentStandups = await standupService.getRecent(200);

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const thisWeek = recentStandups.filter((s) => s.date >= sevenDaysAgo);
    const todayStandups = recentStandups.filter((s) => s.date === today);
    const blockerDays = thisWeek.filter(
      (s) => s.blockers && s.blockers !== 'None',
    );

    const totalIssuesCompleted = thisWeek.reduce(
      (sum, s) => sum + s.yesterday.length, 0,
    );
    const totalIssuesPlanned = thisWeek.reduce(
      (sum, s) => sum + s.today.length, 0,
    );
    const totalEvents = thisWeek.reduce(
      (sum, s) => sum + s.events.length, 0,
    );

    const userActivity = users.map((u) => {
      const userStandups = thisWeek.filter((s) => s.userId === u.slackUserId);
      return {
        userId: u.slackUserId,
        displayName: u.displayName,
        standupsThisWeek: userStandups.length,
        hasBlockers: userStandups.some(
          (s) => s.blockers && s.blockers !== 'None',
        ),
      };
    });

    res.json({
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.standupEnabled).length,
      standupsToday: todayStandups.length,
      standupsThisWeek: thisWeek.length,
      blockersThisWeek: blockerDays.length,
      issuesCompleted: totalIssuesCompleted,
      issuesPlanned: totalIssuesPlanned,
      meetingsThisWeek: totalEvents,
      userActivity,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/standups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const standupService = getStandupService();
    const records = await standupService.getRecent(limit);
    res.json({ records });
  } catch (err) {
    next(err);
  }
});

export default router;
