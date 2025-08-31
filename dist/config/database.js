"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.testConnection = testConnection;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    errorFormat: 'pretty',
});
exports.prisma = prisma;
async function testConnection() {
    try {
        await prisma.$connect();
        console.log('Database connection successful');
    }
    catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
}
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=database.js.map