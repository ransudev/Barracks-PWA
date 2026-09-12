import type { Pool, PoolClient } from "pg";
import type { SupplierInput } from "@/server/schemas/sprint2.schema";

type SupplierRow = {
  id: number;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
  created_at: Date | string;
  updated_at: Date | string;
};

export type SupplierRecord = {
  id: number;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

const selectSupplier = `SELECT id, company_name, contact_person, phone, email, address, notes, status, created_at, updated_at FROM suppliers`;
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const mapSupplier = (row: SupplierRow): SupplierRecord => ({
  id: Number(row.id), companyName: row.company_name, contactPerson: row.contact_person,
  phone: row.phone, email: row.email, address: row.address, notes: row.notes, status: row.status,
  createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
});

export async function listSuppliers(db: Pool): Promise<SupplierRecord[]> {
  const result = await db.query<SupplierRow>(`${selectSupplier} ORDER BY company_name ASC, id ASC`);
  return result.rows.map(mapSupplier);
}

export async function findSupplier(db: Pool | PoolClient, id: number): Promise<SupplierRecord | null> {
  const result = await db.query<SupplierRow>(`${selectSupplier} WHERE id = $1`, [id]);
  return result.rows[0] ? mapSupplier(result.rows[0]) : null;
}

export async function createSupplier(db: Pool, input: SupplierInput): Promise<SupplierRecord> {
  const result = await db.query<{ id: number }>(`
    INSERT INTO suppliers (company_name, contact_person, phone, email, address, notes, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [input.companyName, input.contactPerson, input.phone, input.email, input.address, input.notes, input.status]);
  return (await findSupplier(db, result.rows[0].id))!;
}

export async function updateSupplier(db: Pool, id: number, input: SupplierInput): Promise<SupplierRecord | null> {
  const result = await db.query<{ id: number }>(`
    UPDATE suppliers SET company_name=$1, contact_person=$2, phone=$3, email=$4, address=$5,
      notes=$6, status=$7, updated_at=NOW() WHERE id=$8 RETURNING id`,
    [input.companyName, input.contactPerson, input.phone, input.email, input.address, input.notes, input.status, id]);
  return result.rows[0] ? findSupplier(db, id) : null;
}

export async function supplierIdForUser(db: Pool | PoolClient, userId: number): Promise<number | null> {
  const result = await db.query<{ supplier_id: number }>("SELECT supplier_id FROM supplier_accounts WHERE user_id=$1", [userId]);
  return result.rows[0] ? Number(result.rows[0].supplier_id) : null;
}

export async function linkSupplierAccount(db: Pool, supplierId: number, userId: number): Promise<void> {
  await db.query(`
    INSERT INTO supplier_accounts (supplier_id, user_id) VALUES ($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET supplier_id=EXCLUDED.supplier_id, updated_at=NOW()`, [supplierId, userId]);
}

export async function getSupplierProfile(db: Pool, supplierId: number) {
  const supplier = await findSupplier(db, supplierId);
  if (!supplier) return null;
  const [items, deliveries, restocks] = await Promise.all([
    db.query("SELECT id,name,category,quantity,minimum_stock,maximum_stock,unit,sku,unit_cost,status FROM inventory_items WHERE supplier_id=$1 ORDER BY name", [supplierId]),
    db.query("SELECT id,status,reference,received_at,created_at FROM restock_requests WHERE supplier_id=$1 AND status='Received' ORDER BY received_at DESC NULLS LAST LIMIT 20", [supplierId]),
    db.query("SELECT id,status,reference,notes,created_at,updated_at FROM restock_requests WHERE supplier_id=$1 ORDER BY created_at DESC LIMIT 50", [supplierId]),
  ]);
  return { supplier, suppliedItems: items.rows, recentDeliveries: deliveries.rows, restockHistory: restocks.rows };
}
