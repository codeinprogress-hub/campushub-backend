import mongoose, { Schema } from 'mongoose';
import { Reservation, ReservationStatus } from '../types/reservation';

const reservationStatuses: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED'];

/**
 * Mongoose entity aligned with components/schemas/Reservation.
 * Date-time fields are stored as ISO 8601 strings, matching the OpenAPI `date-time` format.
 * The compound index supports the overlap lookup used by conflict validation.
 */
const reservationSchema = new Schema<Reservation>(
  {
    id: { type: String, required: true, unique: true, trim: true },
    resourceId: { type: String, required: true, trim: true, index: true },
    userId: { type: String, required: true, trim: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { type: String, required: true, enum: reservationStatuses, default: 'PENDING' },
  },
  { versionKey: false, collection: 'reservations' },
);

reservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });

export const ReservationModel =
  mongoose.models.Reservation ?? mongoose.model<Reservation>('Reservation', reservationSchema);
