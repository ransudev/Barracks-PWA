import { pool } from "./pool.js";
import { hashPassword } from "../services/password.service.js";

const seedUsers = [
  {
    username: "admin",
    password: "Admin12345",
    role: "administrator",
  },
  {
    username: "barber",
    password: "Barber12345",
    role: "barber",
  },
  {
    username: "frontdesk",
    password: "FrontDesk12345",
    role: "front_desk",
  },
];

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Seeding users...");

    for (const user of seedUsers) {
      const existing = await client.query<{ userid: number }>(
        "SELECT userid FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
        [user.username]
      );

      if (existing.rowCount) {
        console.log(`User ${user.username} already exists, skipping`);
        continue;
      }

      const passwordHash = await hashPassword(user.password);

      await client.query(
        `
        INSERT INTO users (username, password, role, active)
        VALUES ($1, $2, $3, $4)
      `,
        [user.username, passwordHash, user.role, true]
      );

      console.log(`Created user: ${user.username} (${user.role})`);
    }

    await client.query("COMMIT");
    console.log("Seed data completed successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
