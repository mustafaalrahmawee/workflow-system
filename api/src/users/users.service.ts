import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User, Prisma } from '../../prisma/generated/client/client.js';
import { UsersRepository } from './users.repository.js';
import { RequestUser } from '../auth/decorators/current-user.decorator.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { MessageResponseDto } from '../common/dto/message-response.dto.js';

@Injectable()
export class UsersService {
  private readonly BCRYPT_ROUNDS = 12;

  constructor(private usersRepository: UsersRepository) {}

  async updateProfile(
    currentUser: RequestUser,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    if (dto.email && dto.email !== currentUser.email) {
      const existing: User | null = await this.usersRepository.findByEmail(
        dto.email,
      );
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) updateData.phoneNumber = dto.phoneNumber;

    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(
        dto.password,
        this.BCRYPT_ROUNDS,
      );
    }

    const updated: User = await this.usersRepository.update(
      currentUser.id,
      updateData,
    );
    return new UserResponseDto(updated);
  }

  async adminUpdateUser(
    userId: string,
    dto: AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    const user: User | null = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isEmailVerified !== undefined)
      updateData.isEmailVerified = dto.isEmailVerified;

    const updated: User = await this.usersRepository.update(userId, updateData);
    return new UserResponseDto(updated);
  }

  async softDeleteUser(userId: string): Promise<MessageResponseDto> {
    const user: User | null = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersRepository.softDelete(userId);
    return { message: 'User deleted successfully' };
  }
}
