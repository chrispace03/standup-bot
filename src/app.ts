import express, { Request } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger, notFoundHandler, errorHandler } from './middleware';
import { apiRouter, authRouter, slackRouter } from './routes';

function captureRawBody(req: IncomingMessage, _res: ServerResponse, buf: Buffer): void {
  (req as Request).rawBody = buf;
}

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true, verify: captureRawBody }));
  app.use(requestLogger);

  app.use('/api', apiRouter);
  app.use('/auth', authRouter);
  app.use('/slack', slackRouter);

  // Serve dashboard static files
  const dashboardPath = path.resolve(__dirname, '../dashboard/dist');
  app.use('/dashboard', express.static(dashboardPath));
  app.use('/dashboard', (_req, res, next) => {
    // SPA fallback: serve index.html for non-static routes
    res.sendFile(path.join(dashboardPath, 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
