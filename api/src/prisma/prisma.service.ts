import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../prisma/generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: pg.Pool;

  constructor() {
    // With engineType = "client" (no Rust binaries), an adapter is required
    const connectionString =
      process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'Database URL not configured. Set DIRECT_DATABASE_URL or DATABASE_URL environment variable.',
      );
    }

    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
