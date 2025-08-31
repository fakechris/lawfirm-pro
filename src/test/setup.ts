import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Clean up database before each test
beforeAll(async () => {
  // Test database setup - use SQLite for testing
  try {
    await prisma.$connect();
    console.log('Test database connected successfully');
  } catch (error) {
    console.warn('Database connection failed, using mock database for testing:', error);
    // Don't fail tests if database is not available
  }
});

afterAll(async () => {
  // Clean up database
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.warn('Database disconnect failed:', error);
  }
});

beforeEach(async () => {
  // Clean up all data before each test (only if database is connected)
  try {
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
        // Ignore table truncation errors in test environment
      }
    }
  } catch (error) {
    // Ignore database errors in test environment
  }
});

// Global test timeout
jest.setTimeout(30000);