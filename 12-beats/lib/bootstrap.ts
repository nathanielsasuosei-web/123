/**
 * Optional owner bootstrap.
 *
 * A deployment with no producer account has no way into /admin. Set
 * `PRODUCER_EMAIL` and `PRODUCER_PASSWORD` and the first request creates (or
 * promotes) that account, so a fresh Vercel deploy is usable without a terminal.
 * Unset them and the account is created with `npm run producer:create` instead.
 */
import { config } from "./config";
import { hashPassword } from "./password";
import { query, queryOne } from "./db";

export async function bootstrapProducer(): Promise<void> {
  const email = config.producerBootstrapEmail;
  const password = config.producerBootstrapPassword;
  if (!email || !password) return;

  const existingProducer = await queryOne<{ id: number }>("select id from users where role = 'producer' limit 1");
  if (existingProducer) return;

  const username = config.producerBootstrapUsername || email.split("@")[0].replace(/[^\w.@+-]/g, "") || "producer";
  const existing = await queryOne<{ id: number }>("select id from users where lower(email) = lower($1)", [email]);

  if (existing) {
    await query("update users set role = 'producer' where id = $1", [existing.id]);
    console.log(`[12] Promoted ${email} to producer (from PRODUCER_EMAIL).`);
    return;
  }

  try {
    await query(`insert into users (username, email, password_hash, role) values ($1, $2, $3, 'producer')`, [
      username,
      email.toLowerCase(),
      await hashPassword(password),
    ]);
    console.log(`[12] Created the producer account ${email} from PRODUCER_EMAIL / PRODUCER_PASSWORD.`);
    console.log("[12] Log in and open /admin — then set AUTH_SECRET and remove PRODUCER_PASSWORD.");
  } catch (error) {
    // Username clash with a different email: fall back to a suffixed username.
    console.warn("[12] Producer bootstrap skipped:", (error as Error).message);
  }
}
