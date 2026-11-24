import express, { NextFunction, Request, Response } from 'express';
import { resetMemoryStore } from './data/memory-store';
import { ErrorResponse } from './types/reservation';
import reservationRouter from './routes/reservation.routes';

import './models/user.model';
import './models/resource.model';
import './models/reservation.model';

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

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

  app.use('/api/v1', reservationRouter);

  // Playwright starts the API with E2E=1 so each scenario gets an empty store.
  // The route is absent unless that variable is set.
  if (process.env.E2E === '1') {
    app.post('/api/v1/test/reset', (_req: Request, res: Response) => {
      resetMemoryStore();
      res.status(204).end();
    });
  }

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
