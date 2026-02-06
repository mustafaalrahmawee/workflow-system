import { Exclude, Expose } from 'class-transformer';
import { Role } from '../../../prisma/generated/client/client.js';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  role: Role;

  @Expose()
  isEmailVerified: boolean;

  @Expose()
  createdAt: Date;

  // These are excluded from response
  @Exclude()
  passwordHash: string;

  @Exclude()
  deletedAt: Date | null;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
