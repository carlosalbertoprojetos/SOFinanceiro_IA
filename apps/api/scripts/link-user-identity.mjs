import { randomUUID } from "node:crypto";
import process from "node:process";
import { URL } from "node:url";
import pg from "pg";

const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  values.set(process.argv[index], process.argv[index + 1]);
}

const userId = values.get("--user-id");
const issuer = values.get("--issuer");
const subject = values.get("--subject");
const confirmedUserId = values.get("--confirm-user-id");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!userId || !issuer || !subject || confirmedUserId !== userId) {
  throw new Error(
    "Use --user-id <uuid> --confirm-user-id <same uuid> --issuer <url> --subject <sub>",
  );
}
if (!URL.canParse(issuer) || subject.length > 255) {
  throw new Error("Issuer or subject is invalid");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const user = await client.query(
    'SELECT id FROM "User" WHERE id = $1::uuid FOR UPDATE',
    [userId],
  );
  if (user.rowCount !== 1) throw new Error("Internal user does not exist");

  const existing = await client.query(
    'SELECT "userId" FROM "UserIdentity" WHERE issuer = $1 AND subject = $2',
    [issuer, subject],
  );
  if (existing.rowCount && existing.rows[0].userId !== userId) {
    throw new Error("Identity is already linked to another user");
  }
  if (!existing.rowCount) {
    await client.query(
      'INSERT INTO "UserIdentity" (id, "userId", issuer, subject, "createdAt", "updatedAt") VALUES ($1::uuid, $2::uuid, $3, $4, now(), now())',
      [randomUUID(), userId, issuer, subject],
    );
  }
  await client.query("COMMIT");
  process.stdout.write(
    existing.rowCount
      ? "Identity already linked to this user.\n"
      : "Identity linked.\n",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
