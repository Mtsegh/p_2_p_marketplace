import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration. Prisma 7 reads the database URL here rather than
 * from the schema's `datasource` block, and no longer loads `.env` on its own.
 *
 * Run Prisma commands from `server/` so this file and `server/.env` are found.
 * The fallback URL keeps `prisma generate` (and the `postinstall` hook) working
 * before `.env` exists; migration commands still fail clearly if it is unset.
 */
export default defineConfig({
  schema: "../prisma/schema.prisma",
  migrations: {
    path: "../prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://marketplace:marketplace@localhost:5432/marketplace",
  },
});
