import { Router, Request, Response, NextFunction } from 'express';
import { config, getDb } from '../config';
import { HealthCheckResponse } from '../models';
import { AppError } from '../middleware';
import { UserService } from '../services/user.service';
import { StandupService } from '../services/standup.service';

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
    await userService.update(slackId, req.body);
    const updated = await userService.getBySlackId(slackId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/standup/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    if (!userId) throw new AppError('userId is required', 400);
    const userService = getUserService();
    const user = await userService.getBySlackId(userId);
    if (!user) throw new AppError('User not found', 404);
    // Actual standup generation comes in Phase 6
    res.json({ triggered: true, userId, message: 'Standup trigger received' });
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

export default router;
