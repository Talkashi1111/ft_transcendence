/**
 * Vitest global setup for backend tests
 *
 * This file:
 * 1. Sets up a separate test database
 * 2. Runs migrations on the test database
 * 3. Cleans the database before tests run
 */

import { execSync } from "child_process";
import { beforeAll, afterAll } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Use a separate test database
const TEST_DATABASE_URL = "file:/app/data/database.test.db";

// Set the environment variable for all imports
process.env.DATABASE_URL = TEST_DATABASE_URL;

let prisma: PrismaClient;

beforeAll(async () => {
  console.log("\n🧪 Setting up test database...");

  // Run migrations on test database
  try {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "pipe",
      cwd: process.cwd(),
    });
    console.log("✅ Migrations applied to test database");
  } catch (error) {
    // Log the actual error for debugging (could be permissions, syntax errors, etc.)
    console.error("Migration error:", error);
    console.log("ℹ️  Migrations may already be applied or check error above");
  }

  // Connect to test database and clean it
  const adapter = new PrismaBetterSqlite3({ url: TEST_DATABASE_URL });
  prisma = new PrismaClient({ adapter });

  // Clean all tables before running tests
  await prisma.user.deleteMany();
  console.log("🧹 Test database cleaned");
  console.log(`📍 Using: ${TEST_DATABASE_URL}\n`);
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

export { prisma, TEST_DATABASE_URL };
