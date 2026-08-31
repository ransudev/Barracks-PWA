import { pool } from "../server/db/pool";
import {
  createUserSchema,
  formatValidationErrors,
} from "../server/schemas/user.schema";
import { hashPassword } from "../server/services/password.service";

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required to seed the initial administrator`);
  }

  return value;
}

async function seedInitialAdministrator() {
  const parsed = createUserSchema.safeParse({
    firstName: requiredEnvironmentValue("INITIAL_ADMIN_FIRST_NAME"),
    lastName: requiredEnvironmentValue("INITIAL_ADMIN_LAST_NAME"),
    email: requiredEnvironmentValue("INITIAL_ADMIN_EMAIL"),
    password: requiredEnvironmentValue("INITIAL_ADMIN_PASSWORD"),
    role: "administrator",
  });

  if (!parsed.success) {
    throw new Error(
      Object.entries(formatValidationErrors(parsed.error))
        .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
        .join("; "),
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: number; role: string }>(
      `
        SELECT u.id, r.name AS role
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE LOWER(u.email) = LOWER($1)
          AND u.deleted_at IS NULL
        LIMIT 1
      `,
      [parsed.data.email],
    );

    if (existing.rows[0]) {
      if (existing.rows[0].role !== "administrator") {
        throw new Error(
          "The initial administrator email already belongs to a non-administrator account",
        );
      }

      await client.query("COMMIT");
      console.log("Initial administrator already exists; no changes made");
      return;
    }

    const role = await client.query<{ id: number }>(
      "SELECT id FROM roles WHERE name = $1 LIMIT 1",
      [parsed.data.role],
    );

    if (!role.rows[0]) {
      throw new Error("Administrator role is missing; run npm run db:migrate first");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const inserted = await client.query<{ id: number }>(
      `
        INSERT INTO users (first_name, last_name, email, password_hash, role_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (LOWER(email)) WHERE deleted_at IS NULL DO NOTHING
        RETURNING id
      `,
      [
        parsed.data.firstName,
        parsed.data.lastName,
        parsed.data.email,
        passwordHash,
        role.rows[0].id,
      ],
    );

    await client.query("COMMIT");

    if (inserted.rows[0]) {
      console.log("Initial administrator created");
    } else {
      console.log("Initial administrator already exists; no changes made");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedInitialAdministrator().catch((error) => {
  console.error("Initial administrator seed failed", error);
  process.exitCode = 1;
});
