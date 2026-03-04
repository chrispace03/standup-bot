import { Router, Request, Response } from 'express';
import { config } from '../config';
import { HealthCheckResponse } from '../models';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.app.nodeEnv,
  };
  res.json(response);
});

// Stubs — will be implemented with Firestore in Phase 2
router.get('/user/:slackId', (req: Request, res: Response) => {
  res.json({ message: 'User endpoint stub', slackId: req.params.slackId });
});

router.put('/user/:slackId', (req: Request, res: Response) => {
  res.json({ message: 'User update stub', slackId: req.params.slackId, body: req.body });
});

router.post('/standup/trigger', (_req: Request, res: Response) => {
  res.json({ message: 'Standup trigger stub', triggered: false });
});

router.get('/standup/history', (req: Request, res: Response) => {
  res.json({ message: 'Standup history stub', filters: req.query, records: [] });
});

export default router;
