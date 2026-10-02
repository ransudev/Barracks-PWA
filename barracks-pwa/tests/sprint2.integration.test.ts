import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import type { Pool } from "pg";
import type { UserRole } from "@/server/schemas/user.schema";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

let apiDb: Pool;
let actor: { id: number; role: UserRole } | null;
mock.module("@/server/auth/session", { namedExports: { getCurrentUser: async () => actor } });
mock.module("@/server/db/pool", { namedExports: { pool: { query: (...args: Parameters<Pool["query"]>) => apiDb.query(...args), connect: () => apiDb.connect() } } });

test("Sprint 2 supplier, restock, and receiving workflow is relational and auditable", { skip: !databaseConfigured }, async () => {
  const { db: pool, cleanup } = await createDisposableSchema();
  const [users, suppliers, inventory, restocks] = await Promise.all([
    import("@/server/services/user.service"),
    import("@/server/services/supplier.service"),
    import("@/server/services/inventory.service"),
    import("@/server/services/restock.service"),
  ]);

  let adminUserId: number | null = null;
  let frontDeskUserId: number | null = null;
  let supplierUserId: number | null = null;
  let supplierId: number | null = null;
  let otherSupplierId: number | null = null;
  let inventoryId: number | null = null;
  let secondInventoryId: number | null = null;
  let restockId: number | null = null;

  try {
    const admin = await users.createUser(pool, {
      firstName: "Sprint",
      lastName: "Admin",
      email: `sprint2.admin.${randomUUID()}@barracks.local`,
      password: "password123",
      role: "administrator",
    });
    assert.equal(admin.kind, "created");
    if (admin.kind !== "created") return;
    adminUserId = admin.user.id;

    const frontDesk = await users.createUser(pool, {
      firstName: "Sprint",
      lastName: "Front Desk",
      email: `sprint2.frontdesk.${randomUUID()}@barracks.local`,
      password: "password123",
      role: "front_desk",
    });
    assert.equal(frontDesk.kind, "created");
    if (frontDesk.kind !== "created") return;
    frontDeskUserId = frontDesk.user.id;

    const supplier = await suppliers.createSupplier(pool, {
      companyName: `Supplier ${randomUUID().slice(0, 8)}`,
      contactPerson: "Integration Supplier",
      phone: "09000000000",
      email: `supplier.${randomUUID()}@barracks.local`,
      address: "Davao City",
      notes: "Sprint 2 integration supplier",
      status: "active",
    });
    supplierId = supplier.id;

    const otherSupplier = await suppliers.createSupplier(pool, {
      companyName: `Other ${randomUUID().slice(0, 8)}`,
      contactPerson: "Other Supplier",
      phone: "09000000001",
      email: `other.${randomUUID()}@barracks.local`,
      address: "Davao City",
      notes: "Isolation test",
      status: "active",
    });
    otherSupplierId = otherSupplier.id;

    const supplierRole = await pool.query<{ id: number }>("SELECT id FROM roles WHERE name='supplier' LIMIT 1");
    assert.ok(supplierRole.rows[0]);
    const insertedSupplierUser = await pool.query<{ id: number }>(`
      INSERT INTO users (first_name,last_name,email,password_hash,role_id,is_verified,is_blocked)
      VALUES ('Sprint','Supplier',$1,'test-hash',$2,TRUE,FALSE)
      RETURNING id`,
      [`sprint2.supplier.${randomUUID()}@barracks.local`, supplierRole.rows[0].id],
    );
    supplierUserId = Number(insertedSupplierUser.rows[0].id);
    await pool.query("INSERT INTO supplier_accounts (user_id,supplier_id) VALUES ($1,$2)", [supplierUserId, supplierId]);
    assert.equal(await suppliers.supplierIdForUser(pool, supplierUserId), supplierId);

    const item = await inventory.createInventoryItem(pool, {
      name: `Supplier item ${randomUUID().slice(0, 8)}`,
      category: "Supplies",
      branch: "Main Branch",
      supplierId,
      unit: "bottle",
      sku: `TEST-${randomUUID().slice(0, 8)}`,
      minimumStock: 3,
      maximumStock: 20,
      unitCost: 50,
      status: "active",
      initialQuantity: 2,
    });
    inventoryId = item.id;

    await assert.rejects(
      () => inventory.createInventoryItem(pool, {
        name: `Duplicate SKU ${randomUUID().slice(0, 8)}`,
        category: "Supplies",
        branch: "Main Branch",
        supplierId,
        unit: "bottle",
        sku: item.sku!.toLowerCase(),
        minimumStock: 1,
        maximumStock: 10,
        unitCost: 10,
        status: "active",
        initialQuantity: 0,
      }),
      (error: unknown) => error instanceof Error && error.message === "DUPLICATE_SKU",
      "a case-variant duplicate SKU must be reported as a domain error",
    );

    const editedItem = await inventory.updateInventoryMetadata(pool, inventoryId, adminUserId, {
      name: item.name,
      category: item.category,
      branch: "Maa Branch",
      supplierId: item.supplierId,
      unit: item.unit,
      sku: item.sku,
      minimumStock: 4,
      maximumStock: item.maximumStock,
      unitCost: item.unitCost,
      status: item.status,
    });
    assert.equal(editedItem?.branch, "Main Branch");
    const thresholdHistory = await pool.query<{ branch: string; changed_by: number }>(
      "SELECT branch,changed_by FROM inventory_threshold_history WHERE inventory_item_id=$1 ORDER BY changed_at DESC LIMIT 1",
      [inventoryId],
    );
    assert.equal(thresholdHistory.rows[0]?.branch, "Main Branch");
    assert.equal(Number(thresholdHistory.rows[0]?.changed_by), adminUserId);

    const secondItem = await inventory.createInventoryItem(pool, {
      name: `Second supplier item ${randomUUID().slice(0, 8)}`,
      category: "Supplies",
      branch: "Main Branch",
      supplierId,
      unit: "box",
      sku: `TEST2-${randomUUID().slice(0, 8)}`,
      minimumStock: 1,
      maximumStock: 20,
      unitCost: 20,
      status: "active",
      initialQuantity: 1,
    });
    secondInventoryId = secondItem.id;

    await assert.rejects(
      () => inventory.updateInventoryMetadata(pool, secondInventoryId!, adminUserId!, {
        name: secondItem.name,
        category: secondItem.category,
        branch: secondItem.branch,
        supplierId: secondItem.supplierId,
        unit: secondItem.unit,
        sku: item.sku,
        minimumStock: secondItem.minimumStock,
        maximumStock: secondItem.maximumStock,
        unitCost: secondItem.unitCost,
        status: secondItem.status,
      }),
      (error: unknown) => error instanceof Error && error.message === "DUPLICATE_SKU",
      "editing an item onto another item's SKU must be reported as a domain error",
    );

    await assert.rejects(
      () => restocks.createRestockRequest(pool, adminUserId!, {
        supplierId: otherSupplierId!,
        branch: "Main Branch",
        reference: "wrong-supplier",
        notes: "Must fail",
        items: [{ inventoryItemId: inventoryId!, requestedQuantity: 5, unitCost: 50 }],
      }),
      (error: unknown) => error instanceof Error && error.message === "ITEM_NOT_LINKED_TO_SUPPLIER",
    );

    const restock = await restocks.createRestockRequest(pool, adminUserId, {
      supplierId,
      branch: "Main Branch",
      reference: "PO-TEST",
      notes: "Integration restock",
      items: [
        { inventoryItemId: inventoryId!, requestedQuantity: 5, unitCost: 55 },
        { inventoryItemId: secondInventoryId, requestedQuantity: 3, unitCost: 22 },
      ],
    });
    assert.ok(restock);
    restockId = Number(restock!.id);
    assert.equal(restock!.status, "Pending");

    await assert.rejects(
      () => restocks.updateSupplierRestockStatus(pool, restockId!, otherSupplierId!, "Accepted"),
      (error: unknown) => error instanceof Error && error.message === "RESTOCK_NOT_FOUND",
    );

    assert.equal((await restocks.updateSupplierRestockStatus(pool, restockId, supplierId, "Accepted"))?.status, "Accepted");
    assert.equal((await restocks.updateSupplierRestockStatus(pool, restockId, supplierId, "Preparing"))?.status, "Preparing");
    assert.equal((await restocks.updateSupplierRestockStatus(pool, restockId, supplierId, "Shipped"))?.status, "Shipped");
    await assert.rejects(
      () => restocks.updateSupplierRestockStatus(pool, restockId!, supplierId!, "Delivered"),
      (error: unknown) => error instanceof Error && error.message === "INVALID_STATUS_TRANSITION",
    );

    assert.equal((await restocks.markRestockDelivered(pool, restockId))?.status, "Delivered");
    const beforeReceive = await inventory.findInventoryById(pool, inventoryId);
    assert.equal(beforeReceive?.quantity, 2);

    const currentRequest = await restocks.getRestockRequest(pool, restockId);
    const line = currentRequest?.items?.[0] as { id?: number } | undefined;
    const secondLine = currentRequest?.items?.[1] as { id?: number } | undefined;
    assert.ok(line?.id);
    assert.ok(secondLine?.id);
    const received = await restocks.receiveRestock(pool, restockId, frontDeskUserId!, {
      reference: "DR-TEST",
      notes: "All units received",
      items: [
        { restockRequestItemId: Number(line!.id), deliveredQuantity: 5, unitCost: 55 },
        { restockRequestItemId: Number(secondLine!.id), deliveredQuantity: 3, unitCost: 22 },
      ],
    });
    assert.equal(received?.status, "Received");
    assert.equal((await inventory.findInventoryById(pool, inventoryId))?.quantity, 7);
    assert.equal((await inventory.findInventoryById(pool, secondInventoryId))?.quantity, 4);

    const movement = await pool.query<{ movement_type: string; previous_stock: number; new_stock: number; created_by: number; branch: string; supplier_id: number }>(
      "SELECT movement_type,previous_stock,new_stock,created_by,branch,supplier_id FROM inventory_movements WHERE inventory_item_id=$1 ORDER BY created_at DESC LIMIT 1",
      [inventoryId],
    );
    assert.equal(movement.rows[0]?.movement_type, "RECEIVE");
    assert.equal(Number(movement.rows[0]?.previous_stock), 2);
    assert.equal(Number(movement.rows[0]?.new_stock), 7);
    assert.equal(Number(movement.rows[0]?.created_by), frontDeskUserId);
    assert.equal(movement.rows[0]?.branch, "Main Branch");
    assert.equal(Number(movement.rows[0]?.supplier_id), supplierId);

    await assert.rejects(
      () => restocks.receiveRestock(pool, restockId!, frontDeskUserId!, {
        reference: "DR-DUPLICATE",
        notes: "Must not receive twice",
        items: [
          { restockRequestItemId: Number(line!.id), deliveredQuantity: 5, unitCost: 55 },
          { restockRequestItemId: Number(secondLine!.id), deliveredQuantity: 3, unitCost: 22 },
        ],
      }),
      (error: unknown) => error instanceof Error && error.message === "ALREADY_RECEIVED",
    );

    await suppliers.updateSupplier(pool, supplierId, {
      companyName: supplier.companyName,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      notes: supplier.notes,
      status: "inactive",
    });
    assert.equal(await suppliers.supplierIdForUser(pool, supplierUserId), null, "inactive supplier accounts must lose supplier-owned API scope");
    await assert.rejects(
      () => inventory.createInventoryItem(pool, {
        name: "Inactive supplier item",
        category: "Supplies",
        branch: "Main Branch",
        supplierId: supplierId!,
        unit: "unit",
        sku: `INACTIVE-${randomUUID().slice(0, 8)}`,
        minimumStock: 1,
        maximumStock: 5,
        unitCost: 10,
        status: "active",
        initialQuantity: 0,
      }),
      (error: unknown) => error instanceof Error && error.message === "SUPPLIER_UNAVAILABLE",
    );
  } finally {
    if (restockId) await pool.query("DELETE FROM restock_requests WHERE id=$1", [restockId]);
    if (inventoryId) {
      await pool.query("DELETE FROM inventory_movements WHERE inventory_item_id=$1", [inventoryId]);
      await pool.query("DELETE FROM inventory_threshold_history WHERE inventory_item_id=$1", [inventoryId]);
      await pool.query("DELETE FROM inventory_items WHERE id=$1", [inventoryId]);
    }
    if (secondInventoryId) {
      await pool.query("DELETE FROM inventory_movements WHERE inventory_item_id=$1", [secondInventoryId]);
      await pool.query("DELETE FROM inventory_threshold_history WHERE inventory_item_id=$1", [secondInventoryId]);
      await pool.query("DELETE FROM inventory_items WHERE id=$1", [secondInventoryId]);
    }
    if (supplierUserId) await pool.query("DELETE FROM users WHERE id=$1", [supplierUserId]);
    if (frontDeskUserId) await pool.query("DELETE FROM users WHERE id=$1", [frontDeskUserId]);
    if (supplierId) await pool.query("DELETE FROM suppliers WHERE id=$1", [supplierId]);
    if (otherSupplierId) await pool.query("DELETE FROM suppliers WHERE id=$1", [otherSupplierId]);
    if (adminUserId) await pool.query("DELETE FROM users WHERE id=$1", [adminUserId]);
    await cleanup();
  }
});

test("branch inventory APIs isolate stock, receiving and history with persisted authorization", { skip: !databaseConfigured }, async () => {
  const fixture = await createDisposableSchema(); apiDb = fixture.db;
  const db = apiDb;
  const inventory = await import("@/app/api/inventory/route");
  const item = await import("@/app/api/inventory/[id]/route");
  const movements = await import("@/app/api/inventory/[id]/movements/route");
  const thresholds = await import("@/app/api/inventory/[id]/threshold-history/route");
  const alerts = await import("@/app/api/inventory/alerts/route");
  const acknowledge = await import("@/app/api/inventory/alerts/[id]/acknowledge/route");
  const supplierProfile = await import("@/app/api/suppliers/[id]/route");
  const reports = await import("@/app/api/reports/inventory/route");
  const restocks = await import("@/app/api/restocks/route");
  const delivered = await import("@/app/api/restocks/[id]/delivered/route");
  const receive = await import("@/app/api/restocks/[id]/receive/route");
  const request = (branch: number, body?: unknown) => new Request(`http://localhost/api/inventory?branchId=${branch}`, { ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }) });
  const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
  try {
    const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
    const second = Number((await db.query("INSERT INTO branches(name,code) VALUES('Second Branch','SECOND') RETURNING id")).rows[0].id);
    async function user(role: UserRole) {
      const id = Number((await db.query("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Inventory','Staff',$1,'test',(SELECT id FROM roles WHERE name=$2)) RETURNING id", [`${role}@branch.test`, role])).rows[0].id);
      if (role !== "administrator") await db.query("INSERT INTO user_branches(user_id,branch_id,is_primary) VALUES($1,$2,true)", [id,main]);
      return { id,role };
    }
    const admin = await user("administrator");
    const manager = await user("manager");
    const frontDesk = await user("front_desk");
    actor = admin;
    const supplier = Number((await db.query("INSERT INTO suppliers(company_name,phone) VALUES('Shared Supplier','09123456789') RETURNING id")).rows[0].id);
    const payload = { name: "Same product", category: "Products", branch: "Forged label", supplierId: supplier, unit: "bottle", sku: "SHARED-SKU", minimumStock: 5, maximumStock: 20, unitCost: 10, status: "active", initialQuantity: 4 };
    const mainResponse = await inventory.POST(request(main,payload)); assert.equal(mainResponse.status,201);
    const a = (await mainResponse.json()).item;
    const secondResponse = await inventory.POST(request(second,{ ...payload,initialQuantity: 9 })); assert.equal(secondResponse.status,201);
    const b = (await secondResponse.json()).item;
    assert.equal(a.branchId,main); assert.equal(b.branchId,second); assert.equal(b.branch,"Second Branch");
    assert.equal((await inventory.POST(request(second,payload))).status,409);
    const purchase = { movementType: "CUSTOMER_PURCHASE",quantity: 2,notes: "Sale" };
    assert.equal((await movements.POST(request(second,purchase),params(b.id))).status,201);
    // Even an Administrator cannot mutate an item from the wrong selected workspace.
    assert.equal((await movements.POST(request(main,purchase),params(b.id))).status,403);
    assert.deepEqual((await (await inventory.GET(request(main))).json()).items.map((row: { quantity: number }) => row.quantity),[4]);
    assert.deepEqual((await (await inventory.GET(request(second))).json()).items.map((row: { quantity: number }) => row.quantity),[7]);
    const restockPayload = { supplierId: supplier,branch: "Forged label",notes: "Stock second only",items: [{ inventoryItemId: b.id,requestedQuantity: 3 }] };
    assert.equal((await restocks.POST(request(main,restockPayload))).status,400);
    const createResponse = await restocks.POST(request(second,restockPayload)); assert.equal(createResponse.status,201);
    const restock = (await createResponse.json()).restock;
    assert.equal(Number(restock.branch_id),second);
    await db.query("UPDATE restock_requests SET status='Shipped' WHERE id=$1",[restock.id]);
    for (const staff of [manager,frontDesk]) {
      actor = staff;
      assert.equal((await inventory.GET(request(second))).status,403);
      assert.equal((await item.GET(request(main),params(b.id))).status,403);
      assert.equal((await movements.POST(request(main,purchase),params(b.id))).status,403);
      assert.equal((await item.PUT(request(main,{ ...payload,initialQuantity: undefined }),params(b.id))).status,403);
      assert.equal((await thresholds.GET(request(main),params(b.id))).status,403);
      assert.equal((await alerts.GET(request(second))).status,403);
      assert.equal((await acknowledge.POST(request(main),params(b.id))).status,403);
      assert.equal((await restocks.GET(request(second))).status,403);
      assert.equal((await restocks.POST(request(second,restockPayload))).status,403);
      assert.equal((await delivered.POST(request(main),params(restock.id))).status,403);
      assert.equal((await receive.POST(request(main,{ items: [{ restockRequestItemId: restock.items[0].id,deliveredQuantity: 3 }] }),params(restock.id))).status,403);
    }
    actor = manager;
    assert.deepEqual((await (await inventory.GET(request(main))).json()).items.map((row: { id: number }) => row.id),[a.id]);
    const profile = (await (await supplierProfile.GET(request(main),params(supplier))).json()).profile;
    assert.deepEqual(profile.suppliedItems.map((row: { id: number }) => row.id),[a.id]);
    const report = await reports.GET(request(main)); assert.equal(report.status,200);
    const reportBody = await report.json(); assert.equal(reportBody.valuation.activeItems,1);
    assert.equal(reportBody.movements.length,0);
    actor = admin;
    assert.equal((await delivered.POST(request(second),params(restock.id))).status,200);
    const received = await receive.POST(request(second,{ items: [{ restockRequestItemId: restock.items[0].id,deliveredQuantity: 3 }] }),params(restock.id));
    assert.equal(received.status,200);
    assert.equal((await (await item.GET(request(second),params(b.id))).json()).item.quantity,10);
    assert.equal((await (await item.GET(request(main),params(a.id))).json()).item.quantity,4);
    assert.equal((await receive.POST(request(second,{ items: [{ restockRequestItemId: restock.items[0].id,deliveredQuantity: 3 }] }),params(restock.id))).status,400);
    // Later user assignments, supplier edits and branch renames leave snapshots intact.
    await db.query("UPDATE suppliers SET company_name='Renamed supplier' WHERE id=$1",[supplier]);
    await db.query("DELETE FROM user_branches WHERE user_id=$1",[manager.id]);
    await db.query("UPDATE branches SET name='Renamed branch' WHERE id=$1",[second]);
    const history = (await (await movements.GET(request(second),params(b.id))).json()).movements;
    assert.equal(history.length,2);
    assert.ok(history.every((row: { branch_id: number; branch: string }) => Number(row.branch_id)===second && row.branch==="Second Branch"));
    assert.equal(Number((await db.query("SELECT branch_id FROM restock_requests WHERE id=$1",[restock.id])).rows[0].branch_id),second);
    await assert.rejects(db.query("UPDATE inventory_items SET branch_id=$1 WHERE id=$2",[main,b.id]),{ code:"23514" });
    await assert.rejects(db.query("UPDATE inventory_movements SET branch_id=$1 WHERE inventory_item_id=$2",[main,b.id]),{ code:"23514" });
    await assert.rejects(db.query("UPDATE restock_requests SET branch_id=$1 WHERE id=$2",[main,restock.id]),{ code:"23514" });
    await assert.rejects(db.query("INSERT INTO restock_request_items(restock_request_id,inventory_item_id,requested_quantity) VALUES($1,$2,1)",[restock.id,a.id]),{ code:"23514" });
  } finally { actor=null; await fixture.cleanup(); }
});

test("inventory migration preserves legacy rows and independent historical branch labels", { skip: !databaseConfigured }, async () => {
  const { db,cleanup } = await createDisposableSchema(26);
  const { applyMigrations } = await import("@/server/db/migrate");
  try {
    const main = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
    const second = Number((await db.query("INSERT INTO branches(name,code) VALUES('Known Branch','KNOWN') RETURNING id")).rows[0].id);
    const user = Number((await db.query("INSERT INTO users(first_name,last_name,email,password_hash,role_id) VALUES('Old','Admin','legacy@test.local','test',(SELECT id FROM roles WHERE name='administrator')) RETURNING id")).rows[0].id);
    const supplier = Number((await db.query("INSERT INTO suppliers(company_name) VALUES('Legacy Supplier') RETURNING id")).rows[0].id);
    const item = Number((await db.query("INSERT INTO inventory_items(name,category,quantity,minimum_stock,unit_cost,branch) VALUES('Legacy product','Products',8,2,10,'Known Branch') RETURNING id")).rows[0].id);
    await db.query("INSERT INTO inventory_movements(inventory_item_id,movement_type,quantity,previous_stock,new_stock,created_by,branch) VALUES($1,'USE',1,9,8,$2,'Unknown historical location')",[item,user]);
    const restock = Number((await db.query("INSERT INTO restock_requests(supplier_id,requested_by,branch,status) VALUES($1,$2,'Unknown historical location','Received') RETURNING id",[supplier,user])).rows[0].id);
    await db.query("INSERT INTO restock_request_items(restock_request_id,inventory_item_id,requested_quantity,delivered_quantity) VALUES($1,$2,2,2)",[restock,item]);
    const beforeItem = (await db.query("SELECT * FROM inventory_items WHERE id=$1",[item])).rows[0];
    const beforeMovement = (await db.query("SELECT * FROM inventory_movements WHERE inventory_item_id=$1",[item])).rows[0];
    const beforeRestock = (await db.query("SELECT * FROM restock_requests WHERE id=$1",[restock])).rows[0];
    await applyMigrations(db);
    const { branch_id: itemBranch,...afterItem } = (await db.query("SELECT * FROM inventory_items WHERE id=$1",[item])).rows[0];
    const { branch_id: movementBranch,...afterMovement } = (await db.query("SELECT * FROM inventory_movements WHERE inventory_item_id=$1",[item])).rows[0];
    const { branch_id: restockBranch,...afterRestock } = (await db.query("SELECT * FROM restock_requests WHERE id=$1",[restock])).rows[0];
    assert.equal(itemBranch,second); assert.equal(movementBranch,main); assert.equal(restockBranch,main);
    assert.deepEqual(afterItem,beforeItem); assert.deepEqual(afterMovement,beforeMovement); assert.deepEqual(afterRestock,beforeRestock);
    assert.equal(Number((await db.query("SELECT count(*) FROM restock_request_items WHERE restock_request_id=$1",[restock])).rows[0].count),1);
  } finally { await cleanup(); }
});
