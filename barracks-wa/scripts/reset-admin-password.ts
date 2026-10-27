import { pool } from "../server/db/pool";
import { hashPassword } from "../server/services/password.service";

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required to reset the administrator password`);
  }

  return value;
}

async function resetAdministratorPassword() {
  const email = requiredEnvironmentValue("INITIAL_ADMIN_EMAIL");
  const password = requiredEnvironmentValue("INITIAL_ADMIN_PASSWORD");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const account = await client.query<{ id: number; role: string }>(
      `
        SELECT u.id, r.name AS role
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE LOWER(u.email) = LOWER($1)
          AND u.deleted_at IS NULL
        FOR UPDATE
      `,
      [email],
    );

    if (!account.rows[0]) {
      throw new Error(`Administrator account not found for ${email}`);
    }

    if (account.rows[0].role !== "administrator") {
      throw new Error(`Account ${email} is not an administrator`);
    }

    const passwordHash = await hashPassword(password);
    await client.query(
      `
        UPDATE users
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [passwordHash, account.rows[0].id],
    );
    await client.query("DELETE FROM sessions WHERE user_id = $1", [account.rows[0].id]);
    await client.query("COMMIT");
    console.log(`Administrator password updated for ${email}; existing sessions revoked`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetAdministratorPassword().catch((error) => {
  console.error("Administrator password reset failed", error);
  process.exitCode = 1;
});