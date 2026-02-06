import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';

interface DeviceContext {
  ipAddress?: string;
  deviceInfo?: string;
}

interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_ACTIVE_TOKENS: number;
  private readonly ACCESS_TOKEN_EXPIRY: string;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS: number;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.ACCESS_TOKEN_EXPIRY = this.configService.get('JWT_EXPIRES_IN', '15m');
    this.REFRESH_TOKEN_EXPIRY_DAYS = parseInt(
      this.configService.get('JWT_REFRESH_EXPIRES_IN', '7').replace('d', ''),
      10,
    );
    this.MAX_ACTIVE_TOKENS = parseInt(
      this.configService.get('MAX_REFRESH_TOKENS_PER_USER', '5'),
      10,
    );
  }

  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    const { email, password, ...rest } = registerDto;
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        ...rest,
      },
    });

    return new UserResponseDto(user);
  }

  async login(dto: LoginDto, context: DeviceContext): Promise<AuthResponseDto> {
    // Find user by email (include soft-deleted check)
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        deletedAt: null,
      },
    });

    if (user === null) {
      // Use same error message to prevent email enumeration
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (user.isActive === false || user.deletedAt !== null) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (isPasswordValid === false) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user, context);

    return {
      user: new UserResponseDto(user),
      tokens,
    };
  }

  async refresh(
    refreshToken: string,
    context: DeviceContext,
  ): Promise<AuthResponseDto> {
    // Hash the provided token using SHA256 (same as in generateTokens)
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Find the refresh token
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    // Validate token
    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      // Token was revoked - possible token theft, revoke all user tokens
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: storedToken.user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Check if user is still valid
    if (
      storedToken.user.deletedAt !== null ||
      storedToken.user.isActive === false
    ) {
      throw new UnauthorizedException('User account is not active');
    }

    // Revoke old token (token rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const tokens = await this.generateTokens(storedToken.user, context);

    return {
      user: new UserResponseDto(storedToken.user),
      tokens,
    };
  }

  /**
   * Logout - revoke specific refresh token
   */
  async logout(refreshToken: string, userId: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken) {
      // Token doesn't exist - could be already revoked or invalid
      // Don't throw error, just return success for security
      return;
    }

    // Verify token belongs to user
    if (storedToken.userId !== userId) {
      throw new UnauthorizedException('Token does not belong to user');
    }

    // Revoke token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });
  }

  private async generateTokens(
    user: { id: string; email: string; role: string },
    context: DeviceContext,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (random string)
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenHash,
        userId: user.id,
        expiresAt,
        deviceInfo: context.deviceInfo?.substring(0, 500), // Limit length
        ipAddress: context.ipAddress,
      },
    });

    // Clean up old tokens for this user (keep last 5)
    await this.cleanupOldTokens(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(this.ACCESS_TOKEN_EXPIRY),
    };
  }

  private async cleanupOldTokens(userId: string): Promise<void> {
    // Get all active tokens for user, ordered by creation date
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      skip: this.MAX_ACTIVE_TOKENS,
    });

    if (tokens.length > 0) {
      await this.prisma.refreshToken.updateMany({
        where: {
          id: { in: tokens.map((t) => t.id) },
        },
        data: { revokedAt: new Date() },
      });
    }
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 900;
    }
  }
}
