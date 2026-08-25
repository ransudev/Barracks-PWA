import type { Pool } from "pg";
import { hashPassword } from "@/server/services/password.service";
import type { CreateUserInput, UserRole } from "@/server/schemas/user.schema";

type UserRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  role_description: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type AuthenticatedUserRow = UserRow & {
  password_hash: string;
};

export type PublicUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type AuthenticatedUser = {
  user: PublicUser;
  passwordHash: string;
};

export type CreateUserResult =
  | { kind: "created"; user: PublicUser }
  | { kind: "duplicate" }
  | { kind: "invalid_role" };

const userSelect = `
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    r.name AS role,
    r.description AS role_description,
    u.created_at,
    u.updated_at
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listUsers(db: Pool): Promise<PublicUser[]> {
  const result = await db.query<UserRow>(`${userSelect} ORDER BY u.created_at DESC, u.id DESC`);
  return result.rows.map(toPublicUser);
}

export async function findUserByEmail(
  db: Pool,
  email: string,
): Promise<AuthenticatedUser | null> {
  const result = await db.query<AuthenticatedUserRow>(
    `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.password_hash,
        r.name AS role,
        r.description AS role_description,
        u.created_at,
        u.updated_at
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );
  const row = result.rows[0];

  return row
    ? {
        user: toPublicUser(row),
        passwordHash: row.password_hash,
      }
    : null;
}

export async function findUserById(db: Pool, id: number): Promise<PublicUser | null> {
  const result = await db.query<UserRow>(`${userSelect} WHERE u.id = $1`, [id]);
  return result.rows[0] ? toPublicUser(result.rows[0]) : null;
}

export async function createUser(
  db: Pool,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query<{ id: number }>(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [input.email],
    );

    if (existingUser.rowCount) {
      await client.query("ROLLBACK");
      return { kind: "duplicate" };
    }

    const role = await client.query<{ id: number }>(
      "SELECT id FROM roles WHERE name = $1 LIMIT 1",
      [input.role],
    );

    if (!role.rowCount) {
      await client.query("ROLLBACK");
      return { kind: "invalid_role" };
    }

    const passwordHash = await hashPassword(input.password);
    const inserted = await client.query<{ id: number }>(
      `
        INSERT INTO users (first_name, last_name, email, password_hash, role_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [input.firstName, input.lastName, input.email, passwordHash, role.rows[0].id],
    );

    const created = await client.query<UserRow>(
      `${userSelect} WHERE u.id = $1`,
      [inserted.rows[0].id],
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

function isUniqueViolation(error: unknown): error is { code: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505",
  );
}
