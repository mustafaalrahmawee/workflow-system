import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User, Role } from '@prisma/client';

const SALT_ROUNDS = 10;

export type UserResponse = Omit<User, 'passwordHash' | 'deletedAt'>;

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async register(dto: RegisterDto): Promise<UserResponse> {
    // Check if email already exists
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // Create user with APPLICANT role
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash: passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      role: Role.APPLICANT,
      isEmailVerified: true, // MVP: skip email verification
      isActive: true,
    });

    return this.toUserResponse(user);
  }

  private toUserResponse(user: User): UserResponse {
    const { passwordHash, deletedAt, ...response } = user;
    return response;
  }
}
