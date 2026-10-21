import type { Pool, PoolClient } from "pg";
import type { SupplierInput } from "@/server/schemas/sprint2.schema";

type Queryable = Pool | PoolClient;

type SupplierRow = {
  id: number;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
  has_account: boolean;
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
  hasAccount: boolean;
  createdAt: string;
  updatedAt: string;
};

const selectSupplier = `SELECT s.id, s.company_name, s.contact_person, s.phone, s.email, s.address, s.notes, s.status, s.created_at, s.updated_at,
  EXISTS (SELECT 1 FROM supplier_accounts sa WHERE sa.supplier_id = s.id) AS has_account
  FROM suppliers s`;
const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const mapSupplier = (row: SupplierRow): SupplierRecord => ({
  id: Number(row.id), companyName: row.company_name, contactPerson: row.contact_person,
  phone: row.phone, email: row.email, address: row.address, notes: row.notes, status: row.status,
  hasAccount: Boolean(row.has_account),
  createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
});

async function assertUniqueActiveSupplierName(db: Queryable, companyName: string, excludeId?: number): Promise<void> {
  const params: unknown[] = [companyName];
  let sql = "SELECT id FROM suppliers WHERE status='active' AND LOWER(BTRIM(company_name))=LOWER(BTRIM($1))";
  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id<>$${params.length}`;
  }
  sql += " LIMIT 1";
  const duplicate = await db.query(sql, params);
  if (duplicate.rows[0]) throw new Error("DUPLICATE_SUPPLIER_NAME");
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

export async function listSuppliers(db: Pool): Promise<SupplierRecord[]> {
  const result = await db.query<SupplierRow>(`${selectSupplier} ORDER BY company_name ASC, id ASC`);
  return result.rows.map(mapSupplier);
}

export async function findSupplier(db: Pool | PoolClient, id: number): Promise<SupplierRecord | null> {
  const result = await db.query<SupplierRow>(`${selectSupplier} WHERE id = $1`, [id]);
  return result.rows[0] ? mapSupplier(result.rows[0]) : null;
}

export async function createSupplier(db: Pool, input: SupplierInput): Promise<SupplierRecord> {
  if (input.status === "active") await assertUniqueActiveSupplierName(db, input.companyName);
  try {
    const result = await db.query<{ id: number }>(`
      INSERT INTO suppliers (company_name, contact_person, phone, email, address, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [input.companyName, input.contactPerson, input.phone, input.email, input.address, input.notes, input.status]);
    return (await findSupplier(db, result.rows[0].id))!;
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("DUPLICATE_SUPPLIER_NAME");
    throw error;
  }
}

export async function updateSupplier(db: Pool, id: number, input: SupplierInput, allowDeactivate = true): Promise<SupplierRecord | null> {
  if (input.status === "active") await assertUniqueActiveSupplierName(db, input.companyName, id);
  try {
    const result = await db.query<{ id: number }>(`
      UPDATE suppliers SET company_name=$1, contact_person=$2, phone=$3, email=$4, address=$5,
        notes=$6, status=$7, updated_at=NOW()
      WHERE id=$8 AND ($9::boolean OR NOT (status='active' AND $7::varchar='inactive')) RETURNING id`,
      [input.companyName, input.contactPerson, input.phone, input.email, input.address, input.notes, input.status, id, allowDeactivate]);
    return result.rows[0] ? findSupplier(db, id) : null;
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("DUPLICATE_SUPPLIER_NAME");
    throw error;
  }
}

export async function supplierIdForUser(db: Pool | PoolClient, userId: number): Promise<number | null> {
  const result = await db.query<{ supplier_id: number }>(`
    SELECT sa.supplier_id
    FROM supplier_accounts sa
    INNER JOIN suppliers s ON s.id=sa.supplier_id AND s.status='active'
    WHERE sa.user_id=$1`, [userId]);
  return result.rows[0] ? Number(result.rows[0].supplier_id) : null;
}

export async function linkSupplierAccount(db: Pool, supplierId: number, userId: number): Promise<void> {
  await db.query(`
    INSERT INTO supplier_accounts (supplier_id, user_id) VALUES ($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET supplier_id=EXCLUDED.supplier_id, updated_at=NOW()`, [supplierId, userId]);
}

export async function getSupplierProfile(db: Pool, supplierId: number, branchIds?: number[]) {
  const supplier = await findSupplier(db, supplierId);
  if (!supplier) return null;
  const [items, deliveries, restocks] = await Promise.all([
    db.query("SELECT id,name,category,quantity,minimum_stock,maximum_stock,unit,sku,unit_cost,status,branch,branch_id FROM inventory_items WHERE supplier_id=$1 AND ($2::integer[] IS NULL OR branch_id=ANY($2)) ORDER BY name", [supplierId,branchIds ?? null]),
    db.query("SELECT id,status,branch,branch_id,reference,received_at,created_at FROM restock_requests WHERE supplier_id=$1 AND ($2::integer[] IS NULL OR branch_id=ANY($2)) AND status='Received' ORDER BY received_at DESC NULLS LAST LIMIT 20", [supplierId,branchIds ?? null]),
    db.query("SELECT id,status,branch,branch_id,reference,notes,created_at,updated_at FROM restock_requests WHERE supplier_id=$1 AND ($2::integer[] IS NULL OR branch_id=ANY($2)) ORDER BY created_at DESC LIMIT 50", [supplierId,branchIds ?? null]),
  ]);
  return { supplier, suppliedItems: items.rows, recentDeliveries: deliveries.rows, restockHistory: restocks.rows };
}

// Replace which inventory items in one branch this supplier provides. Items still
// tied to an open restock request keep their supplier so the delivery can be received.
export async function setSupplierItems(db: Pool, supplierId: number, branchId: number, itemIds: number[]) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const supplier = await client.query("SELECT id FROM suppliers WHERE id=$1 AND status='active' FOR SHARE", [supplierId]);
    if (!supplier.rows[0]) throw new Error("SUPPLIER_UNAVAILABLE");
    const owned = await client.query<{ id: number }>("SELECT id FROM inventory_items WHERE id = ANY($1::int[]) AND branch_id=$2 FOR UPDATE", [itemIds, branchId]);
    if (owned.rows.length !== new Set(itemIds).size) throw new Error("ITEM_NOT_IN_BRANCH");
    const removed = await client.query<{ name: string }>(`
      SELECT i.name FROM inventory_items i
      WHERE i.supplier_id=$1 AND i.branch_id=$2 AND NOT (i.id = ANY($3::int[]))
        AND EXISTS (SELECT 1 FROM restock_request_items ri JOIN restock_requests r ON r.id=ri.restock_request_id
          WHERE ri.inventory_item_id=i.id AND r.supplier_id=$1 AND r.status NOT IN ('Received','Cancelled'))`,
      [supplierId, branchId, itemIds]);
    if (removed.rows[0]) throw Object.assign(new Error("ITEM_HAS_OPEN_RESTOCK"), { itemName: removed.rows[0].name });
    await client.query("UPDATE inventory_items SET supplier_id=NULL, updated_at=NOW() WHERE supplier_id=$1 AND branch_id=$2 AND NOT (id = ANY($3::int[]))", [supplierId, branchId, itemIds]);
    await client.query("UPDATE inventory_items SET supplier_id=$1, updated_at=NOW() WHERE id = ANY($2::int[]) AND branch_id=$3 AND supplier_id IS DISTINCT FROM $1", [supplierId, itemIds, branchId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
