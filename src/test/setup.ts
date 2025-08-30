import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Clean up database before each test
beforeAll(async () => {
  // Test database setup
  await prisma.$connect();
});

afterAll(async () => {
  // Clean up database
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up all data before each test
  const tables = [
    'audit_logs',
    'sessions',
    'user_permissions',
    'user_roles',
    'role_permissions',
    'user_profiles',
    'users',
    'permissions',
    'roles',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (error) {
      console.warn(`Failed to truncate table ${table}:`, error);
    }
  }
});

// Global test timeout
jest.setTimeout(30000);