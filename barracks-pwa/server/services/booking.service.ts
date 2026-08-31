import type { Pool } from "pg";
import { services } from "@/app/data/services";
import type {
  BookingCreateInput,
  BookingUpdateInput,
} from "@/server/schemas/sprint.schema";

type BookingRow = {
  id: number;
  booking_date: string | Date;
  booking_time: string | Date;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  barber_id: number;
  barber_name: string;
  service_id: string;
  service_name: string;
  service_price: number | string;
  status: "upcoming" | "completed" | "cancelled";
  created_at: string | Date;
  updated_at: string | Date;
};

export type BookingRecord = {
  id: number;
  date: string;
  time: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  barberId: number;
  barberName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  status: BookingRow["status"];
  createdAt: string;
  updatedAt: string;
};

export class BookingServiceError extends Error {
  constructor(
    public readonly kind: "not_found" | "unavailable" | "conflict" | "past",
    message: string,
  ) {
    super(message);
    this.name = "BookingServiceError";
  }
}

const bookingSelect = `
  SELECT
    b.id,
    b.booking_date,
    b.booking_time,
    c.id AS customer_id,
    CONCAT(cu.first_name, ' ', cu.last_name) AS customer_name,
    cu.email AS customer_email,
    br.id AS barber_id,
    CONCAT(br.first_name, ' ', br.last_name) AS barber_name,
    b.service_id,
    b.service_name,
    b.service_price,
    b.status,
    b.created_at,
    b.updated_at
  FROM bookings b
  INNER JOIN customers c ON c.id = b.customer_id
  INNER JOIN users cu ON cu.id = c.user_id
  INNER JOIN barbers br ON br.id = b.barber_id
`;

function toDateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function toTimeOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(11, 16) : String(value).slice(0, 5);
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toBooking(row: BookingRow): BookingRecord {
  return {
    id: Number(row.id),
    date: toDateOnly(row.booking_date),
    time: toTimeOnly(row.booking_time),
    customerId: Number(row.customer_id),
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    barberId: Number(row.barber_id),
    barberName: row.barber_name,
    serviceId: row.service_id,
    serviceName: row.service_name,
    price: Number(row.service_price),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listBookings(
  db: Pool,
  customerId?: number,
): Promise<BookingRecord[]> {
  const result = await db.query<BookingRow>(
    `${bookingSelect}
      ${customerId ? "WHERE b.customer_id = $1" : ""}
      ORDER BY b.booking_date ASC, b.booking_time ASC, b.id ASC`,
    customerId ? [customerId] : undefined,
  );
  return result.rows.map(toBooking);
}

export async function createBooking(
  db: Pool,
  input: BookingCreateInput & { customerId: number },
): Promise<BookingRecord> {
  const slot = new Date(`${input.date}T${input.time}:00+08:00`);
  if (Number.isNaN(slot.getTime()) || slot.getTime() <= Date.now()) {
    throw new BookingServiceError("past", "Choose a future booking time");
  }

  const service = services.find((item) => item.id === input.serviceId && item.active);
  if (!service) {
    throw new BookingServiceError("not_found", "That service is not available");
  }

  const customer = await db.query<{ id: number }>(
    `
      SELECT c.id
      FROM customers c
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN roles r ON r.id = u.role_id AND r.name = 'customer'
      WHERE c.id = $1
      LIMIT 1
    `,
    [input.customerId],
  );
  if (!customer.rows[0]) {
    throw new BookingServiceError("not_found", "Customer not found");
  }

  const barber = await db.query<{ id: number; status: string }>(
    "SELECT id, status FROM barbers WHERE id = $1 LIMIT 1",
    [input.barberId],
  );
  if (!barber.rows[0]) {
    throw new BookingServiceError("not_found", "Barber not found");
  }
  if (barber.rows[0].status === "unavailable") {
    throw new BookingServiceError("unavailable", "That barber is currently unavailable");
  }

  try {
    const inserted = await db.query<{ id: number }>(
      `
        INSERT INTO bookings
          (customer_id, barber_id, service_id, service_name, service_price, booking_date, booking_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        input.customerId,
        input.barberId,
        service.id,
        service.name,
        service.price,
        input.date,
        input.time,
      ],
    );
    return (await findBookingById(db, inserted.rows[0].id)) as BookingRecord;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BookingServiceError("conflict", "That barber is already booked for this time");
    }
    throw error;
  }
}

export async function findBookingById(
  db: Pool,
  id: number,
): Promise<BookingRecord | null> {
  const result = await db.query<BookingRow>(
    `${bookingSelect} WHERE b.id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ? toBooking(result.rows[0]) : null;
}

export async function updateBooking(
  db: Pool,
  id: number,
  input: BookingUpdateInput,
): Promise<BookingRecord | null> {
  const result = await db.query<{ id: number }>(
    `
      UPDATE bookings
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `,
    [input.status, id],
  );
  return result.rows[0] ? findBookingById(db, id) : null;
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505",
  );
}
