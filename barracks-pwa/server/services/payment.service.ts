import type { Pool } from "pg";
import type { CreateTransactionInput, PaymentMethod, PaymentStatus } from "@/server/schemas/payment.schema";

type VisitRow = {
  booking_id: number | null; queue_entry_id: number | null; customer_id: number;
  barber_id: number; service_id: string; customer_name: string;
  barber_name: string; service_name: string; amount: string;
};
type TransactionRow = VisitRow & {
  id: string; reference: string; visit_type: "booking" | "queue" | "legacy"; visit_record_id: string;
  processed_by: number | null; cashier_name: string | null;
  payment_method: PaymentMethod | "mixed"; status: PaymentStatus; created_at: Date | string;
};

export type TransactionRecord = {
  id: number; reference: string; visitType: "booking" | "queue" | "legacy"; visitRecordId: number;
  bookingId: number | null; queueEntryId: number | null;
  customerId: number; barberId: number; serviceId: string; processedBy: number | null;
  customerName: string; barberName: string; cashierName: string | null; serviceName: string;
  amount: number; paymentMethod: PaymentMethod | "mixed"; status: PaymentStatus; createdAt: string;
};

export class PaymentServiceError extends Error {
  constructor(public readonly kind: "not_found" | "conflict" | "forbidden", message: string) {
    super(message);
  }
}

function toTransaction(row: TransactionRow): TransactionRecord {
  return {
    id: Number(row.id), reference: row.reference, visitType: row.visit_type, visitRecordId: Number(row.visit_record_id),
    bookingId: row.booking_id === null ? null : Number(row.booking_id),
    queueEntryId: row.queue_entry_id === null ? null : Number(row.queue_entry_id),
    customerId: Number(row.customer_id), barberId: Number(row.barber_id), serviceId: row.service_id,
    processedBy: row.processed_by === null ? null : Number(row.processed_by),
    customerName: row.customer_name, barberName: row.barber_name, cashierName: row.cashier_name,
    serviceName: row.service_name, amount: Number(row.amount), paymentMethod: row.payment_method,
    status: row.status, createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function findTransactionByReference(db: Pool, reference: string): Promise<TransactionRecord | null> {
  const result = await db.query<TransactionRow>("SELECT * FROM transactions WHERE reference=$1", [reference]);
  return result.rows[0] ? toTransaction(result.rows[0]) : null;
}

export async function createTransaction(db: Pool, input: CreateTransactionInput, cashierId: number): Promise<TransactionRecord> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const cashier = await client.query<{ name: string }>(
      `SELECT concat_ws(' ',u.first_name,u.last_name) AS name FROM users u
       JOIN roles r ON r.id=u.role_id WHERE u.id=$1 AND u.deleted_at IS NULL
       AND r.name IN ('administrator','manager','front_desk') FOR SHARE OF u`, [cashierId],
    );
    if (!cashier.rows[0]) throw new PaymentServiceError("forbidden", "A current staff account is required");

    const bookingId = "bookingId" in input.visit ? input.visit.bookingId : null;
    const queueEntryId = "queueEntryId" in input.visit ? input.visit.queueEntryId : null;
    const result = bookingId !== null
      ? await client.query<VisitRow>(
        `SELECT b.id AS booking_id, NULL::bigint AS queue_entry_id, b.customer_id, b.barber_id,
          b.service_id, b.service_name, b.service_price AS amount,
          concat_ws(' ',COALESCE(cu.first_name,c.first_name),COALESCE(cu.last_name,c.last_name)) AS customer_name,
          concat_ws(' ',br.first_name,br.last_name) AS barber_name
         FROM bookings b JOIN customers c ON c.id=b.customer_id
         LEFT JOIN users cu ON cu.id=c.user_id JOIN barbers br ON br.id=b.barber_id
         WHERE b.id=$1 AND b.status='completed' FOR UPDATE OF b`, [bookingId],
      )
      : await client.query<VisitRow>(
        `SELECT NULL::bigint AS booking_id, q.id AS queue_entry_id, q.customer_id, q.barber_id,
          q.service_id, s.name AS service_name, s.current_price AS amount,
          concat_ws(' ',COALESCE(cu.first_name,c.first_name),COALESCE(cu.last_name,c.last_name)) AS customer_name,
          concat_ws(' ',br.first_name,br.last_name) AS barber_name
         FROM queue_entries q JOIN customers c ON c.id=q.customer_id
         LEFT JOIN users cu ON cu.id=c.user_id JOIN barbers br ON br.id=q.barber_id
         JOIN services s ON s.id=q.service_id
         WHERE q.id=$1 AND q.booking_id IS NULL AND q.status='completed' FOR UPDATE OF q`, [queueEntryId],
      );
    const visit = result.rows[0];
    if (!visit) throw new PaymentServiceError("not_found", "Completed visit not found");

    const inserted = await client.query<TransactionRow>(
      `INSERT INTO transactions
        (customer_id,booking_id,queue_entry_id,visit_type,visit_record_id,barber_id,service_id,processed_by,
         customer_name,barber_name,cashier_name,service_name,amount,payment_method,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'completed') RETURNING *`,
      [visit.customer_id, visit.booking_id, visit.queue_entry_id, bookingId !== null ? "booking" : "queue",
        bookingId ?? queueEntryId, visit.barber_id, visit.service_id, cashierId,
        visit.customer_name, visit.barber_name, cashier.rows[0].name,
        visit.service_name, visit.amount, input.paymentMethod],
    );
    const transaction = inserted.rows[0];
    await client.query(
      `INSERT INTO transaction_payments(transaction_id,payment_method,amount,status)
       VALUES ($1,$2,$3,'completed')`,
      [transaction.id, input.paymentMethod, visit.amount],
    );
    await client.query("COMMIT");
    return toTransaction(transaction);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
      throw new PaymentServiceError("conflict", "A transaction already exists for this visit");
    }
    throw error;
  } finally {
    client.release();
  }
}
