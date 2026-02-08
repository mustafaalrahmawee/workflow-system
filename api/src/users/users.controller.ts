import { Controller, Patch, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { RequestUser } from '../auth/decorators/current-user.decorator.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: RequestUser,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user, dto);
  }
}
