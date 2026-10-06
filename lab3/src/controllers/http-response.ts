import { Response } from 'express';
import { HttpError } from '../errors/http-error';
import { ErrorResponse } from '../types/reservation';

/** Maps a service error onto the contract status codes. This is the only place that sets them. */
export function sendFailure(res: Response, error: unknown): void {
  if (error instanceof HttpError) {
    const body: ErrorResponse = error.toResponse();
    if (error.status === 400) {
      res.status(400).json(body);
      return;
    }
    if (error.status === 409) {
      res.status(409).json(body);
      return;
    }
    res.status(error.status).json(body);
    return;
  }

  const body: ErrorResponse = {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  };
  res.status(500).json(body);
}
