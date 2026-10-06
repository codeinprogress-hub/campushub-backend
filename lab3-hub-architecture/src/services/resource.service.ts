import mongoose, { Types } from 'mongoose';
import { HttpError } from '../errors/http-error';
import { ResourceEntity, ResourceModel } from '../models/Resource.model';
import { Resource } from '../types/reservation';

export interface StoredResource extends ResourceEntity {
  _id: Types.ObjectId;
}

const SEEDED_RESOURCES: readonly ResourceEntity[] = [
  {
    id: 'res-101',
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: true,
  },
  {
    id: 'res-102',
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Student Center Makerspace',
    isAvailable: true,
  },
  {
    id: 'res-103',
    name: 'Chemistry Teaching Lab',
    type: 'LAB',
    location: 'Science Hall, Room 210',
    isAvailable: true,
  },
];

function toResource(record: ResourceEntity): Resource {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    location: record.location,
    isAvailable: record.isAvailable,
  };
}

/** Inserts the Lab 2 catalog when those public ids are not already stored. */
export async function ensureSeedCatalog(): Promise<void> {
  for (const resource of SEEDED_RESOURCES) {
    await ResourceModel.updateOne(
      { id: resource.id },
      { $setOnInsert: resource },
      { upsert: true },
    );
  }
}

export async function listResources(type: unknown, typeWasProvided: boolean): Promise<Resource[]> {
  const filter: { type?: string } = {};

  if (typeWasProvided) {
    if (typeof type !== 'string' || type.trim().length === 0) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'type must be a non-empty string when provided.',
      );
    }
    filter.type = type.trim();
  }

  const rows = await ResourceModel.find(filter).sort({ id: 1 }).lean<StoredResource[]>();
  return rows.map((row) => toResource(row));
}

export async function findResourceByPublicId(publicId: string): Promise<StoredResource | null> {
  return ResourceModel.findOne({ id: publicId }).lean<StoredResource | null>();
}

export async function findPublicIdsByObjectIds(
  objectIds: readonly Types.ObjectId[],
): Promise<Map<string, string>> {
  const publicIds = new Map<string, string>();
  if (objectIds.length === 0) {
    return publicIds;
  }

  const rows = await ResourceModel.find({
    _id: { $in: objectIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).lean<StoredResource[]>();

  for (const row of rows) {
    publicIds.set(row._id.toString(), row.id);
  }
  return publicIds;
}
