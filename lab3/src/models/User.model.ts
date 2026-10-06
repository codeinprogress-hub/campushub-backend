import mongoose, { Model, Schema } from 'mongoose';
import { User, UserRole } from '../types/reservation';

const USER_ROLES: UserRole[] = ['STUDENT', 'FACULTY', 'STAFF'];

/**
 * Persisted user, aligned with components/schemas/User.
 * This lab does not expose a user route; the schema is the database contract only.
 */
export interface UserEntity {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

const userSchema = new Schema<UserEntity>(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    role: { type: String, required: true, enum: USER_ROLES },
  },
  {
    versionKey: false,
    id: false,
    collection: 'users',
  },
);

export const UserModel: Model<UserEntity> =
  (mongoose.models.User as Model<UserEntity> | undefined) ??
  mongoose.model<UserEntity>('User', userSchema);

export type { User };
