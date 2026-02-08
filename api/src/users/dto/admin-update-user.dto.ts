import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { Role } from '../../../prisma/generated/client/client.js';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEnum(Role, { message: 'Role must be APPLICANT, REVIEWER, or ADMIN' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;
}
