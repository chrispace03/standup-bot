import express, { Request } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
