// Runs once before the integration suite: create the test database if missing, then
// apply migrations to it. Requires Docker Postgres running.
import { execSync } from "node:child_process";
import "dotenv/config";
import { Client } from "pg";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example).");

  const dbName = new URL(url).pathname.slice(1);
  const adminUrl = url.replace(`/${dbName}`, "/postgres");

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  // Drop + recreate on every run: the test DB is disposable fixture data, and forcing
  // NOT NULL/required columns onto a non-empty table (e.g. an FK migration) would
  // otherwise fail against whatever rows a prior run left behind.
  await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
