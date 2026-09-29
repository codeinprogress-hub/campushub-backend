import mongoose, { Schema } from 'mongoose';
import { User, UserRole } from '../types/reservation';

const userRoles: UserRole[] = ['STUDENT', 'FACULTY', 'STAFF'];

/**
 * Mongoose entity aligned with components/schemas/User.
 * The lab runtime does not connect to MongoDB; this schema is the database contract.
 */
const userSchema = new Schema<User>(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    role: { type: String, required: true, enum: userRoles },
  },
  { versionKey: false, collection: 'users' },
);

export const UserModel = mongoose.models.User ?? mongoose.model<User>('User', userSchema);
