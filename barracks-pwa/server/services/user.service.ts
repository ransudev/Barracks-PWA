import type { Pool, PoolClient } from "pg";
import { hashPassword } from "@/server/services/password.service";
import type {
  CreateUserInput,
  UpdateStaffUserInput,
  UserLifecycleInput,
  UserRole,
} from "@/server/schemas/user.schema";

type UserRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  role_description: string;
  is_verified: boolean;
  is_blocked: boolean;
  deleted_at: Date | string | null;
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
  isVerified: boolean;
  isBlocked: boolean;
  isActive: boolean;
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

export type UserMutationResult =
  | { kind: "updated"; user: PublicUser }
  | { kind: "deleted" }
  | { kind: "not_found" }
  | { kind: "duplicate" }
  | { kind: "invalid_role" }
  | { kind: "last_admin" };

const USER_ADMIN_LOCK_KEY = 918273;

const userSelect = `
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    r.name AS role,
    r.description AS role_description,
    u.is_verified,
    u.is_blocked,
    u.deleted_at,
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
    isVerified: Boolean(row.is_verified),
    isBlocked: Boolean(row.is_blocked),
    isActive: row.deleted_at === null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function lockAdministratorMutations(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock($1)", [USER_ADMIN_LOCK_KEY]);
}

async function activeAdministratorCount(client: PoolClient): Promise<number> {
  const result = await client.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id AND r.name = 'administrator'
    WHERE u.deleted_at IS NULL
  `);
  return Number(result.rows[0]?.count ?? 0);
}

export async function listUsers(db: Pool): Promise<PublicUser[]> {
  const result = await db.query<UserRow>(
    `${userSelect}
      WHERE r.name IN ('administrator', 'front_desk')
        AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC, u.id DESC`,
  );
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
        u.is_verified,
        u.is_blocked,
        u.deleted_at,
        u.created_at,
        u.updated_at
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.email) = LOWER($1)
        AND u.deleted_at IS NULL
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
  const result = await db.query<UserRow>(
    `${userSelect} WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id],
  );
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
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1",
      [input.email],
    );

    if (existingUser.rowCount) {
      await client.query("ROLLBACK");
      return { kind: "duplicate" };
    }

    const role = await client.query<{ id: number }>(
      "SELECT id FROM roles WHERE name = $1 AND name IN ('administrator', 'front_desk') LIMIT 1",
      [input.role],
    );

    if (!role.rowCount) {
      await client.query("ROLLBACK");
      return { kind: "invalid_role" };
    }

    const passwordHash = await hashPassword(input.password);
    const inserted = await client.query<{ id: number }>(
      `
        INSERT INTO users
          (first_name, last_name, email, password_hash, role_id, is_verified, is_blocked)
        VALUES ($1, $2, $3, $4, $5, FALSE, FALSE)
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

export async function updateStaffUser(
  db: Pool,
  id: number,
  input: UpdateStaffUserInput,
): Promise<UserMutationResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await lockAdministratorMutations(client);

    const current = await client.query<UserRow>(
      `${userSelect}
        WHERE u.id = $1
          AND u.deleted_at IS NULL
          AND r.name IN ('administrator', 'front_desk')
        FOR UPDATE`,
      [id],
    );
    const existing = current.rows[0];

    if (!existing) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }

    if (existing.role === "administrator" && input.role !== "administrator" && (await activeAdministratorCount(client)) <= 1) {
      await client.query("ROLLBACK");
      return { kind: "last_admin" };
    }

    const role = await client.query<{ id: number }>(
      "SELECT id FROM roles WHERE name = $1 AND name IN ('administrator', 'front_desk') LIMIT 1",
      [input.role],
    );
    if (!role.rows[0]) {
      await client.query("ROLLBACK");
      return { kind: "invalid_role" };
    }

    if (input.password) {
      const passwordHash = await hashPassword(input.password);
      await client.query(
        `
          UPDATE users
          SET first_name = $1, last_name = $2, email = $3, role_id = $4,
              password_hash = $5, updated_at = NOW()
          WHERE id = $6
        `,
        [input.firstName, input.lastName, input.email, role.rows[0].id, passwordHash, id],
      );
      await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    } else {
      await client.query(
        `
          UPDATE users
          SET first_name = $1, last_name = $2, email = $3, role_id = $4,
              updated_at = NOW()
          WHERE id = $5
        `,
        [input.firstName, input.lastName, input.email, role.rows[0].id, id],
      );
    }

    const updated = await client.query<UserRow>(`${userSelect} WHERE u.id = $1`, [id]);
    await client.query("COMMIT");
    return { kind: "updated", user: toPublicUser(updated.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(error)) return { kind: "duplicate" };
    throw error;
  } finally {
    client.release();
  }
}

export async function updateUserLifecycle(
  db: Pool,
  id: number,
  input: UserLifecycleInput,
): Promise<UserMutationResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await lockAdministratorMutations(client);

    const current = await client.query<UserRow>(
      `${userSelect}
        WHERE u.id = $1
          AND u.deleted_at IS NULL
          AND r.name IN ('administrator', 'front_desk')
        FOR UPDATE`,
      [id],
    );
    const existing = current.rows[0];

    if (!existing) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }

    const nextVerified = input.action === "verify" || input.action === "unblock"
      ? input.action === "verify" ? true : existing.is_verified
      : input.action === "unverify" ? false : existing.is_verified;
    const nextBlocked = input.action === "block"
      ? true
      : input.action === "unblock" ? false : existing.is_blocked;
    const disablesAccount = !nextVerified || nextBlocked;

    if (existing.role === "administrator" && disablesAccount && (await activeAdministratorCount(client)) <= 1) {
      await client.query("ROLLBACK");
      return { kind: "last_admin" };
    }

    await client.query(
      `
        UPDATE users
        SET is_verified = $1, is_blocked = $2, updated_at = NOW()
        WHERE id = $3
      `,
      [nextVerified, nextBlocked, id],
    );

    if (disablesAccount) {
      await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    }

    const updated = await client.query<UserRow>(`${userSelect} WHERE u.id = $1`, [id]);
    await client.query("COMMIT");
    return { kind: "updated", user: toPublicUser(updated.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteUser(db: Pool, id: number): Promise<UserMutationResult> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await lockAdministratorMutations(client);

    const current = await client.query<{ role: UserRole }>(
      `
        SELECT r.name AS role
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 AND u.deleted_at IS NULL
        FOR UPDATE
      `,
      [id],
    );
    const existing = current.rows[0];

    if (!existing) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }

    if (existing.role === "administrator" && (await activeAdministratorCount(client)) <= 1) {
      await client.query("ROLLBACK");
      return { kind: "last_admin" };
    }

    const deleted = await client.query<{ id: number }>(
      `
        UPDATE users
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
      `,
      [id],
    );

    if (!deleted.rowCount) {
      await client.query("ROLLBACK");
      return { kind: "not_found" };
    }

    await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    await client.query("COMMIT");
    return { kind: "deleted" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
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
