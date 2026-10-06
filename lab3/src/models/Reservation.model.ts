import mongoose, { Model, Schema, Types } from 'mongoose';
import { ReservationStatus } from '../types/reservation';

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;

/**
 * Persisted reservation. `resourceId` is an ObjectId reference to Resource.
 * `id` is the public contract identifier (`rsv-1001`) returned by the API.
 */
export interface ReservationEntity {
  id: string;
  resourceId: Types.ObjectId;
  userId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

const reservationSchema = new Schema<ReservationEntity>(
  {
    id: { type: String, required: true, unique: true, trim: true },
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: 'Resource',
      required: true,
      index: true,
    },
    userId: { type: String, required: true, trim: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: RESERVATION_STATUSES,
      default: 'PENDING',
    },
  },
  {
    versionKey: false,
    id: false,
    collection: 'reservations',
  },
);

reservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });

export const ReservationModel: Model<ReservationEntity> =
  (mongoose.models.Reservation as Model<ReservationEntity> | undefined) ??
  mongoose.model<ReservationEntity>('Reservation', reservationSchema);
