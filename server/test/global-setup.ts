import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://marketplace:marketplace@localhost:5432/marketplace_test";

/**
 * Applies committed migrations to the test database before any suite runs.
 * Refuses to run unless the database name ends in `_test`, so a bad
 * TEST_DATABASE_URL can never wipe the development database.
 */
export default function setup(): void {
  const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

  const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "");

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests: TEST_DATABASE_URL points at "${databaseName}", which does not end in _test.`,
    );
  }

  const serverRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );

  execSync("npx --no-install prisma migrate deploy", {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
