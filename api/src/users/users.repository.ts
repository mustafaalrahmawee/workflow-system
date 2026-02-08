import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { User, Role, Prisma } from '../../prisma/generated/client/client.js';

export type UserListItem = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'isActive' | 'createdAt'
>;

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  async findMany(filters: {
    role?: Role;
    isActive?: boolean;
    includeDeleted?: boolean;
    skip: number;
    take: number;
  }): Promise<[UserListItem[], number]> {
    const where: Prisma.UserWhereInput = {};

    if (filters.role !== undefined) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (!filters.includeDeleted) where.deletedAt = null;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        skip: filters.skip,
        take: filters.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return [users, total];
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
