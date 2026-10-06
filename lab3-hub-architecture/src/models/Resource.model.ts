import mongoose, { Model, Schema } from 'mongoose';
import { ResourceType } from '../types/reservation';

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;

/**
 * Persisted resource. `id` is the public contract identifier (`res-101`).
 * Reservations reference the MongoDB `_id`, not this string.
 */
export interface ResourceEntity {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

const resourceSchema = new Schema<ResourceEntity>(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: RESOURCE_TYPES },
    location: { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, required: true },
  },
  {
    versionKey: false,
    id: false,
    collection: 'resources',
  },
);

export const ResourceModel: Model<ResourceEntity> =
  (mongoose.models.Resource as Model<ResourceEntity> | undefined) ??
  mongoose.model<ResourceEntity>('Resource', resourceSchema);
