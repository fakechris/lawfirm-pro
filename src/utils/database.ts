import { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';

@injectable()
export class Database {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  get client() {
    return this.prisma;
  }

  async connect() {
    try {
      await this.prisma.$connect();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
    console.log('Database disconnected');
  }

  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', message: 'Database connection is healthy' };
    } catch (error) {
      return { status: 'unhealthy', message: 'Database connection failed', error };
    }
  }
}