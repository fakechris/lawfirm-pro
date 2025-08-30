"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
beforeAll(async () => {
    await prisma.$connect();
});
afterAll(async () => {
    await prisma.$disconnect();
});
beforeEach(async () => {
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
            console.warn(`Failed to truncate table ${table}:`, error);
        }
    }
});
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map