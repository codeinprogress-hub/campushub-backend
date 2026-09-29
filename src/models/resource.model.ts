import mongoose, { Schema } from 'mongoose';
import { Resource, ResourceType } from '../types/reservation';

const resourceTypes: ResourceType[] = ['ROOM', 'EQUIPMENT', 'LAB'];

/**
 * Mongoose entity aligned with components/schemas/Resource.
 * The lab runtime serves the in-memory catalog instead of this collection.
 */
const resourceSchema = new Schema<Resource>(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: resourceTypes },
    location: { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, required: true },
  },
  { versionKey: false, collection: 'resources' },
);

export const ResourceModel =
  mongoose.models.Resource ?? mongoose.model<Resource>('Resource', resourceSchema);
