// Runs in each test worker before test modules: point the Prisma client at the
// dedicated test database (src/lib/db reads DATABASE_URL at module load).
import "dotenv/config";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is not set (see .env.example).");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
