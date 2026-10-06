import express, { NextFunction, Request, Response } from 'express';
import { connectDatabase } from './config/database';
import { ErrorResponse } from './types/reservation';
import apiRouter from './routes';

import './models/User.model';
import './models/Resource.model';
import './models/Reservation.model';

export async function createApp(): Promise<express.Express> {
  const app = express();

  app.use(express.json());
  await connectDatabase();

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      name: 'CampusHub Reservation API',
      version: '1.0.0',
      contract: 'docs/openapi.yaml',
      endpoints: [
        'GET /api/v1/resources',
        'POST /api/v1/reservations',
        'GET /api/v1/reservations/user/{userId}',
      ],
    });
  });

  app.use('/api/v1', apiRouter);

  app.use((req: Request, res: Response) => {
    const body: ErrorResponse = {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.path}.`,
    };
    res.status(404).json(body);
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) {
      const body: ErrorResponse = {
        code: 'VALIDATION_ERROR',
        message: 'Request body must be valid JSON.',
      };
      res.status(400).json(body);
      return;
    }

    const body: ErrorResponse = {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    };
    res.status(500).json(body);
  });

  return app;
}
