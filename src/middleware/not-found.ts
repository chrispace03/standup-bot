import { Request, Response } from 'express';
import { ApiErrorResponse } from '../models';

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiErrorResponse = {
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    statusCode: 404,
  };
  res.status(404).json(response);
}
