import { PrismaClient } from "@prisma/client";
import { isDev } from "@/lib/config/env";

/**
 * Prisma singleton. Next's dev server re-evaluates modules on every hot reload,
 * so the client is parked on globalThis to avoid exhausting the DB connection
 * pool with a new client per reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev() ? ["warn", "error"] : ["error"],
  });

if (isDev()) globalForPrisma.prisma = db;
