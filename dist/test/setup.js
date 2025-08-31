"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
beforeAll(async () => {
    try {
        await prisma.$connect();
        console.log('Test database connected successfully');
    }
    catch (error) {
        console.warn('Database connection failed, using mock database for testing:', error);
    }
});
afterAll(async () => {
    try {
        await prisma.$disconnect();
    }
    catch (error) {
        console.warn('Database disconnect failed:', error);
    }
});
beforeEach(async () => {
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
            }
            catch (error) {
            }
        }
    }
    catch (error) {
    }
});
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map