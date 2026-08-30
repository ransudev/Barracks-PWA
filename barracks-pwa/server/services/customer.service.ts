import type { Pool } from "pg";
import { hashPassword } from "@/server/services/password.service";
import type {
  CustomerProfileInput,
  CustomerSignupInput,
} from "@/server/schemas/sprint.schema";

type CustomerRow = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  preferred_barber_id: number | null;
  preferred_barber_name: string | null;
  loyalty_points: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CustomerRecord = {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredBarberId: number | null;
  preferredBarberName: string | null;
  loyaltyPoints: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerInput = CustomerSignupInput;

const customerSelect = `
  SELECT
    c.id,
    c.user_id,
    u.first_name,
    u.last_name,
    u.email,
    c.phone,
    c.preferred_barber_id,
    CASE
      WHEN b.id IS NULL THEN NULL
      ELSE CONCAT(b.first_name, ' ', b.last_name)
    END AS preferred_barber_name,
    c.loyalty_points,
    c.created_at,
    c.updated_at
  FROM customers c
  INNER JOIN users u ON u.id = c.user_id
  LEFT JOIN barbers b ON b.id = c.preferred_barber_id
`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    preferredBarberId: row.preferred_barber_id === null ? null : Number(row.preferred_barber_id),
    preferredBarberName: row.preferred_barber_name,
    loyaltyPoints: Number(row.loyalty_points),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listCustomers(db: Pool): Promise<CustomerRecord[]> {
  const result = await db.query<CustomerRow>(
    `${customerSelect}
      INNER JOIN roles r ON r.id = u.role_id AND r.name = 'customer'
      ORDER BY u.first_name ASC, u.last_name ASC, c.id ASC`,
  );
  return result.rows.map(toCustomer);
}

export async function findCustomerById(db: Pool, id: number): Promise<CustomerRecord | null> {
  const result = await db.query<CustomerRow>(
    `${customerSelect}
      INNER JOIN roles r ON r.id = u.role_id AND r.name = 'customer'
      WHERE c.id = $1
      LIMIT 1`,
    [id],
  );
  return result.rows[0] ? toCustomer(result.rows[0]) : null;
}

export async function findCustomerByUserId(
  db: Pool,
  userId: number,
): Promise<CustomerRecord | null> {
  const result = await db.query<CustomerRow>(
    `${customerSelect}
      INNER JOIN roles r ON r.id = u.role_id AND r.name = 'customer'
      WHERE c.user_id = $1
      LIMIT 1`,
    [userId],
  );
  return result.rows[0] ? toCustomer(result.rows[0]) : null;
}

export async function createCustomer(
  db: Pool,
  input: CreateCustomerInput,
): Promise<{ kind: "created"; customer: CustomerRecord } | { kind: "duplicate" }> {
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
      "SELECT id FROM roles WHERE name = 'customer' LIMIT 1",
    );
    if (!role.rows[0]) {
      throw new Error("Customer role is missing; run the database migration first");
    }

    const passwordHash = await hashPassword(input.password);
    const insertedUser = await client.query<{ id: number }>(
      `
        INSERT INTO users (first_name, last_name, email, password_hash, role_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [input.firstName, input.lastName, input.email, passwordHash, role.rows[0].id],
    );

    const insertedCustomer = await client.query<{ id: number }>(
      `
        INSERT INTO customers (user_id, phone, preferred_barber_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [insertedUser.rows[0].id, input.phone, input.preferredBarberId],
    );

    await client.query("COMMIT");
    const customer = await findCustomerById(db, insertedCustomer.rows[0].id);
    if (!customer) throw new Error("Unable to read created customer");
    return { kind: "created", customer };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(error)) return { kind: "duplicate" };
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCustomer(
  db: Pool,
  id: number,
  input: CustomerProfileInput,
): Promise<CustomerRecord | null> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const target = await client.query<{ user_id: number }>(
      `
        SELECT c.user_id
        FROM customers c
        INNER JOIN users u ON u.id = c.user_id
        INNER JOIN roles r ON r.id = u.role_id AND r.name = 'customer'
        WHERE c.id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!target.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
        UPDATE users
        SET first_name = $1, last_name = $2, email = $3, updated_at = NOW()
        WHERE id = $4
      `,
      [input.firstName, input.lastName, input.email, target.rows[0].user_id],
    );
    await client.query(
      `
        UPDATE customers
        SET phone = $1, preferred_barber_id = $2, updated_at = NOW()
        WHERE id = $3
      `,
      [input.phone, input.preferredBarberId, id],
    );

    await client.query("COMMIT");
    return findCustomerById(db, id);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(error)) throw new Error("A user with this email already exists");
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
