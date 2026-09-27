import type { Pool, PoolClient } from "pg";
import { BarberOperationalAvailabilityError, getBarberOperationalAvailability, requireBarberOperationalAvailability } from "@/server/services/barber-operational-availability.service";

type Db = Pool | PoolClient;
export type QueueStatus = "waiting" | "ready" | "in_progress" | "completed" | "removed";
type QueueRow = {
  id: number; booking_id: number | null; customer_id: number; customer_name: string;
  service_id: string; service_name: string; barber_id: number | null; barber_name: string | null;
  status: QueueStatus; joined_at: Date | string; started_at: Date | string | null;
  completed_at: Date | string | null; created_at: Date | string; updated_at: Date | string;
};
export type QueueRecord = {
  id: number; bookingId: number | null; customerId: number; customerName: string;
  serviceId: string; serviceName: string; barberId: number | null; barberName: string | null;
  status: QueueStatus; joinedAt: string; startedAt: string | null;
  completedAt: string | null; createdAt: string; updatedAt: string;
};
export class QueueServiceError extends Error {
  constructor(public readonly kind: "invalid" | "not_found" | "conflict", message: string) { super(message); }
}
async function withQueueTransaction<T>(db: Pool, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof BarberOperationalAvailabilityError) throw new QueueServiceError("conflict", error.message);
    if (isActiveBarberConflict(error)) throw new QueueServiceError("conflict", "Barber is currently serving another customer.");
    throw error;
  } finally { client.release(); }
}
export function isActiveBarberConflict(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && "constraint" in error &&
    (error as { code?: string }).code === "23505" &&
    (error as { constraint?: string }).constraint === "queue_entries_one_active_service_per_barber");
}
async function requireBarber(client: PoolClient, barberId: number): Promise<void> {
  // Every queue start takes this same row lock before checking active work.
  const locked = await client.query("SELECT id FROM barbers WHERE id=$1 FOR UPDATE", [barberId]);
  if (!locked.rowCount) throw new QueueServiceError("not_found", "Barber not found.");
  requireBarberOperationalAvailability(await getBarberOperationalAvailability(client, barberId));
}
const queueSelect = `SELECT q.*, CONCAT(u.first_name,' ',u.last_name) AS customer_name,
  s.name AS service_name, CASE WHEN br.id IS NULL THEN NULL ELSE CONCAT(br.first_name,' ',br.last_name) END AS barber_name
  FROM queue_entries q JOIN customers c ON c.id=q.customer_id JOIN users u ON u.id=c.user_id
  JOIN services s ON s.id=q.service_id LEFT JOIN barbers br ON br.id=q.barber_id`;
const iso = (value: Date | string | null) => value === null ? null : new Date(value).toISOString();
function toQueue(row: QueueRow): QueueRecord {
  return { id: Number(row.id), bookingId: row.booking_id === null ? null : Number(row.booking_id),
    customerId: Number(row.customer_id), customerName: row.customer_name, serviceId: row.service_id,
    serviceName: row.service_name, barberId: row.barber_id === null ? null : Number(row.barber_id),
    barberName: row.barber_name, status: row.status, joinedAt: iso(row.joined_at)!, startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at), createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)! };
}
export async function listQueue(db: Db): Promise<QueueRecord[]> {
  const result = await db.query<QueueRow>(`${queueSelect} WHERE q.status <> 'removed' ORDER BY q.joined_at, q.id`);
  return result.rows.map(toQueue);
}
export async function findQueueEntry(db: Db, id: number): Promise<QueueRecord | null> {
  const result = await db.query<QueueRow>(`${queueSelect} WHERE q.id=$1`, [id]);
  return result.rows[0] ? toQueue(result.rows[0]) : null;
}
export async function addWalkIn(db: Pool, input: { customerId: number; serviceId: string; barberId?: number | null }): Promise<QueueRecord> {
  return withQueueTransaction(db, async (client) => {
    if (input.barberId != null) await requireBarber(client, input.barberId);
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO queue_entries(customer_id,service_id,barber_id,status)
       SELECT c.id,s.id,br.id,CASE WHEN br.id IS NULL THEN 'waiting' ELSE 'ready' END
       FROM customers c JOIN users u ON u.id=c.user_id JOIN roles r ON r.id=u.role_id AND r.name='customer'
       CROSS JOIN services s LEFT JOIN barbers br ON br.id=$3 AND br.status<>'unavailable'
       WHERE c.id=$1 AND u.deleted_at IS NULL AND s.id=$2 AND s.active=true
         AND ($3::integer IS NULL OR br.id IS NOT NULL) RETURNING id`,
      [input.customerId, input.serviceId, input.barberId ?? null],
    );
    if (!inserted.rows[0]) throw new QueueServiceError("invalid", "Choose an active customer, service, and available barber");
    return (await findQueueEntry(client, inserted.rows[0].id))!;
  });
}
export async function assignQueueBarber(db: Pool, id: number, barberId: number | null): Promise<QueueRecord> {
  return withQueueTransaction(db, async (client) => {
    await client.query("SELECT id FROM queue_entries WHERE id=$1 FOR UPDATE", [id]);
    if (barberId !== null) await requireBarber(client, barberId);
    const result = await client.query<{ id: number }>(
      `UPDATE queue_entries q SET barber_id=$2, status=CASE WHEN $2::integer IS NULL THEN 'waiting' ELSE 'ready' END, updated_at=NOW()
       WHERE q.id=$1 AND q.booking_id IS NULL AND q.status IN ('waiting','ready')
         AND ($2::integer IS NULL OR EXISTS(SELECT 1 FROM barbers WHERE id=$2 AND status<>'unavailable')) RETURNING id`,
      [id, barberId],
    );
    if (!result.rows[0]) throw new QueueServiceError("conflict", "This queue entry cannot be assigned that barber");
    return (await findQueueEntry(client, id))!;
  });
}
export async function updateWalkInStatus(db: Pool, id: number, status: QueueStatus): Promise<QueueRecord> {
  const expected: Record<QueueStatus, QueueStatus[]> = {
    waiting: [], ready: ["waiting"], in_progress: ["waiting", "ready"], completed: ["in_progress"], removed: ["waiting", "ready"],
  };
  if (!expected[status].length) throw new QueueServiceError("invalid", "Invalid queue status");
  return withQueueTransaction(db, async (client) => {
    if (status === "ready" || status === "in_progress") {
      const candidate = await client.query<{ barber_id: number | null }>(
        "SELECT barber_id FROM queue_entries WHERE id=$1 AND booking_id IS NULL FOR UPDATE", [id]);
      if (candidate.rows[0]?.barber_id != null) await requireBarber(client, candidate.rows[0].barber_id);
    }
    const result = await client.query<{ id: number }>(
      `UPDATE queue_entries SET status=$2::varchar,
         started_at=CASE WHEN $2::varchar='in_progress' THEN NOW() ELSE started_at END,
         completed_at=CASE WHEN $2::varchar='completed' THEN NOW() ELSE completed_at END,
         updated_at=NOW()
       WHERE id=$1 AND booking_id IS NULL AND status=ANY($3::text[])
         AND ($2::varchar NOT IN ('ready','in_progress') OR barber_id IS NOT NULL) RETURNING id`,
      [id, status, expected[status]],
    );
    if (!result.rows[0]) throw new QueueServiceError("conflict", "Queue status changed or a barber must be assigned first");
    return (await findQueueEntry(client, id))!;
  });
}

export async function syncAppointmentQueue(client: PoolClient, bookingId: number, status: "checked_in" | "in_progress" | "completed" | "cancelled"): Promise<void> {
  if (status === "checked_in") {
    await client.query(
      `INSERT INTO queue_entries(booking_id,customer_id,service_id,barber_id,status)
       SELECT id,customer_id,service_id,barber_id,'ready' FROM bookings WHERE id=$1
       ON CONFLICT (booking_id) DO NOTHING`, [bookingId],
    );
    return;
  }
  const queueStatus = status === "in_progress" ? "in_progress" : status === "completed" ? "completed" : "removed";
  const result = await client.query(
    `UPDATE queue_entries SET status=$2::varchar,
       started_at=CASE WHEN $2::varchar='in_progress' THEN NOW() ELSE started_at END,
       completed_at=CASE WHEN $2::varchar='completed' THEN NOW() ELSE completed_at END, updated_at=NOW()
     WHERE booking_id=$1 AND status=$3 RETURNING id`,
    [bookingId, queueStatus, status === "in_progress" ? "ready" : status === "completed" ? "in_progress" : "ready"],
  );
  if (!result.rowCount) throw new QueueServiceError("conflict", "Appointment queue entry is missing or out of sync");
}
