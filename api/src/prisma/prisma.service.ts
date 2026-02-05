import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: pg.Pool | null = null;

  constructor() {
    const directUrl = process.env.DIRECT_DATABASE_URL;

    if (directUrl) {
      const pool = new pg.Pool({ connectionString: directUrl });
      const adapter = new PrismaPg(pool);
      super({ adapter });
      // Store pool reference for cleanup - use Object.assign to avoid TypeScript issues
      Object.assign(PrismaService.prototype, { pool });
    } else {
      // Fallback to accelerate URL if no direct connection available
      super({
        accelerateUrl: process.env.DATABASE_URL,
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (this.pool) {
      await this.pool.end();
    }
  }
}
