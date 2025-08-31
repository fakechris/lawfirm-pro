import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<{
    log: ("info" | "query" | "warn" | "error")[];
    errorFormat: "pretty";
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare function testConnection(): Promise<void>;
export { prisma, testConnection };
//# sourceMappingURL=database.d.ts.map