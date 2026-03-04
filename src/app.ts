import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger, notFoundHandler, errorHandler } from './middleware';
import { apiRouter } from './routes';

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
