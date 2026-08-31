import type { Pool } from "pg";
import { hashPassword, verifyPassword } from "./password.service.js";
import type { CreateUserInput, UpdateUserInput, UserRole } from "../schemas/user.schema.js";

type UserRow = {
  userid: number;
  username: string;
  password: string;
  role: UserRole;
  lastlogin: Date | string | null;
  active: boolean;
};

export type PublicUser = {
  userID: number;
  username: string;
  role: UserRole;
  lastLogin: string | null;
  active: boolean;
};

export type CreateUserResult =
  | { kind: "created"; user: PublicUser }
  | { kind: "duplicate" }
  | { kind: "invalid_role" };

export type LoginResult =
  | { kind: "success"; user: PublicUser }
  | { kind: "invalid_credentials" }
  | { kind: "inactive" };

export type UpdateUserResult =
  | { kind: "updated"; user: PublicUser }
  | { kind: "not_found" }
  | { kind: "duplicate" }
  | { kind: "invalid_role" };

const userSelect = `
  SELECT
    userid,
    username,
    role,
    lastlogin,
    active
  FROM users
`;

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    userID: Number(row.userid),
    username: row.username,
    role: row.role,
    lastLogin: toIso(row.lastlogin),
    active: Boolean(row.active),
  };
}

export async function listUsers(db: Pool): Promise<PublicUser[]> {
  const result = await db.query<UserRow>(`${userSelect} ORDER BY userid DESC`);
  return result.rows.map(toPublicUser);
}

export async function findUserById(db: Pool, id: number): Promise<PublicUser | null> {
  const result = await db.query<UserRow>(`${userSelect} WHERE userid = $1`, [id]);
  return result.rows[0] ? toPublicUser(result.rows[0]) : null;
}

export async function findUserByUsername(db: Pool, username: string): Promise<PublicUser | null> {
  const result = await db.query<UserRow>(`${userSelect} WHERE LOWER(username) = LOWER($1)`, [username]);
  return result.rows[0] ? toPublicUser(result.rows[0]) : null;
}

export async function createUser(
  db: Pool,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query<{ userid: number }>(
      "SELECT userid FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [input.username],
    );

    if (existingUser.rowCount) {
      await client.query("ROLLBACK");
      return { kind: "duplicate" };
    }

    const role = await client.query<{ rolename: string }>(
      "SELECT rolename FROM roles WHERE rolename = $1 LIMIT 1",
      [input.role],
    );

    if (!role.rowCount) {
      await client.query("ROLLBACK");
      return { kind: "invalid_role" };
    }

    const passwordHash = await hashPassword(input.password);
    const inserted = await client.query<{ userid: number }>(
      `
        INSERT INTO users (username, password, role)
        VALUES ($1, $2, $3)
        RETURNING userid
      `,
      [input.username, passwordHash, role.rows[0].rolename],
    );

    const created = await client.query<UserRow>(
      `${userSelect} WHERE userid = $1`,
      [inserted.rows[0].userid],
    );

    await client.query("COMMIT");
    return { kind: "created", user: toPublicUser(created.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (isUniqueViolation(error)) {
      return { kind: "duplicate" };
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function loginUser(db: Pool, username: string, password: string): Promise<LoginResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<{ userid: number; password: string; active: boolean }>(
      "SELECT userid, password, active FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [username],
    );

    console.log("User query result count:", result.rowCount);
    console.log("Raw user result:", result.rows);
    console.log("First user row:", result.rows[0]);

    if (!result.rowCount) {
      console.log("User not found in database");
      await client.query("ROLLBACK");
      return { kind: "invalid_credentials" };
    }

    const user = result.rows[0];
    console.log("User found, active status:", user.active);

    if (!user.active) {
      console.log("User account is inactive");
      await client.query("ROLLBACK");
      return { kind: "inactive" };
    }

    const isValid = await verifyPassword(password, user.password);
    console.log("Password validation result:", isValid);

    if (!isValid) {
      console.log("Password verification failed");
      await client.query("ROLLBACK");
      return { kind: "invalid_credentials" };
    }

    // Update lastLogin
    await client.query(
      "UPDATE users SET lastlogin = NOW() WHERE userid = $1",
      [user.userid],
    );

    console.log("Fetching full user for userID:", user.userid);
    const fullUser = await findUserById(db, user.userid);
    console.log("Full user result:", fullUser);

    if (!fullUser) {
      console.log("Full user not found after login");
      await client.query("ROLLBACK");
      return { kind: "invalid_credentials" };
    }

    await client.query("COMMIT");
    return { kind: "success", user: fullUser };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateUser(
  db: Pool,
  id: number,
  input: UpdateUserInput,
): Promise<UpdateUserResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{ userid: number }>(
      "SELECT userid FROM users WHERE userid = $1 LIMIT 1",
      [id],
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }

    if (input.username) {
      const duplicate = await client.query<{ userid: number }>(
        "SELECT userid FROM users WHERE LOWER(username) = LOWER($1) AND userid != $2 LIMIT 1",
        [input.username, id],
      );

      if (duplicate.rowCount) {
        await client.query("ROLLBACK");
        return { kind: "duplicate" };
      }
    }

    if (input.role) {
      const role = await client.query<{ rolename: string }>(
        "SELECT rolename FROM roles WHERE rolename = $1 LIMIT 1",
        [input.role],
      );

      if (!role.rowCount) {
        await client.query("ROLLBACK");
        return { kind: "invalid_role" };
      }
    }

    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (input.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      values.push(input.username);
    }

    if (input.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(input.role);
    }

    if (input.active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      values.push(input.active);
    }

    if (input.password !== undefined) {
      const passwordHash = await hashPassword(input.password);
      updates.push(`password = $${paramIndex++}`);
      values.push(passwordHash);
    }

    values.push(id);

    if (updates.length > 0) {
      await client.query(
        `UPDATE users SET ${updates.join(", ")} WHERE userid = $${paramIndex}`,
        values,
      );
    }

    const updated = await client.query<UserRow>(
      `${userSelect} WHERE userid = $1`,
      [id],
    );

    await client.query("COMMIT");
    return { kind: "updated", user: toPublicUser(updated.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (isUniqueViolation(error)) {
      return { kind: "duplicate" };
    }

    throw error;
  } finally {
    client.release();
  }
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505",
  );
}
