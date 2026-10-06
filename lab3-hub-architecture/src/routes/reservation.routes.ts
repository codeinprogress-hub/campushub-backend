import { Router } from 'express';
import {
  createReservationHandler,
  listUserReservationsHandler,
} from '../controllers/reservation.controller';

const reservationRouter = Router();

reservationRouter.post('/reservations', createReservationHandler);
reservationRouter.get('/reservations/user/:userId', listUserReservationsHandler);

export default reservationRouter;
