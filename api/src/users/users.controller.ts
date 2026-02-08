import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Role } from '../../prisma/generated/client/client.js';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { RequestUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { MessageResponseDto } from '../common/dto/message-response.dto.js';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto.js';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.listUsers(query);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: RequestUser,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async adminUpdateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.adminUpdateUser(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async softDeleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MessageResponseDto> {
    return this.usersService.softDeleteUser(id);
  }
}
