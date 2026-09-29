import { Router, Request, Response } from 'express';
import { HttpError } from '../errors/http-error';
import { ErrorResponse } from '../types/reservation';
import {
  createReservation,
  listActiveReservationsForUser,
  listResources,
} from '../services/reservation.service';

const reservationRouter = Router();

function sendFailure(res: Response, error: unknown): void {
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

/**
 * GET /resources
 * Lists resources. `type` is optional; an empty value is 400.
 */
reservationRouter.get('/resources', (req: Request, res: Response) => {
  try {
    const typeWasProvided = Object.prototype.hasOwnProperty.call(req.query, 'type');
    const resources = listResources(req.query.type, typeWasProvided);
    res.status(200).json(resources);
  } catch (error) {
    sendFailure(res, error);
  }
});

/**
 * POST /reservations
 * 201 Created with the stored reservation, 409 when the time slot overlaps,
 * 400 when the body fails contract validation.
 */
reservationRouter.post('/reservations', (req: Request, res: Response) => {
  try {
    const reservation = createReservation(req.body);
    res.status(201).json(reservation);
  } catch (error) {
    sendFailure(res, error);
  }
});

/**
 * GET /reservations/user/:userId
 * Active reservations (PENDING or CONFIRMED) for one student.
 */
reservationRouter.get('/reservations/user/:userId', (req: Request, res: Response) => {
  try {
    const reservations = listActiveReservationsForUser(req.params.userId);
    res.status(200).json(reservations);
  } catch (error) {
    sendFailure(res, error);
  }
});

export default reservationRouter;
