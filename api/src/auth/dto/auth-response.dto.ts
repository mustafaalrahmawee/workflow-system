import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class TokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

export class AuthResponseDto {
  user: UserResponseDto;
  tokens: TokensDto;
}
