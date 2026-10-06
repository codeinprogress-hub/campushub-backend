import { Request, Response } from 'express';
import {
  createReservation,
  listActiveReservationsForUser,
} from '../services/reservation.service';
import { sendFailure } from './http-response';

/** POST /reservations — 201 when stored, 400 on validation, 409 on overlap. */
export async function createReservationHandler(req: Request, res: Response): Promise<void> {
  try {
    const reservation = await createReservation(req.body);
    res.status(201).json(reservation);
  } catch (error: unknown) {
    sendFailure(res, error);
  }
}

/** GET /reservations/user/:userId — active reservations for one student. */
export async function listUserReservationsHandler(req: Request, res: Response): Promise<void> {
  try {
    const reservations = await listActiveReservationsForUser(req.params.userId);
    res.status(200).json(reservations);
  } catch (error: unknown) {
    sendFailure(res, error);
  }
}
