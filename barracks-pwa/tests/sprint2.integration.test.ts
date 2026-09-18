import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

test("Sprint 2 supplier, restock, and receiving workflow is relational and auditable", { skip: !databaseConfigured }, async () => {
  const [{ pool }, users, suppliers, inventory, restocks] = await Promise.all([
    import("@/server/db/pool"),
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
    assert.equal(editedItem?.branch, "Maa Branch");
    const thresholdHistory = await pool.query<{ branch: string; changed_by: number }>(
      "SELECT branch,changed_by FROM inventory_threshold_history WHERE inventory_item_id=$1 ORDER BY changed_at DESC LIMIT 1",
      [inventoryId],
    );
    assert.equal(thresholdHistory.rows[0]?.branch, "Maa Branch");
    assert.equal(Number(thresholdHistory.rows[0]?.changed_by), adminUserId);

    const secondItem = await inventory.createInventoryItem(pool, {
      name: `Second supplier item ${randomUUID().slice(0, 8)}`,
      category: "Supplies",
      branch: "Maa Branch",
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
      () => restocks.createRestockRequest(pool, adminUserId!, {
        supplierId: otherSupplierId!,
        branch: "Maa Branch",
        reference: "wrong-supplier",
        notes: "Must fail",
        items: [{ inventoryItemId: inventoryId!, requestedQuantity: 5, unitCost: 50 }],
      }),
      (error: unknown) => error instanceof Error && error.message === "ITEM_NOT_LINKED_TO_SUPPLIER",
    );

    const restock = await restocks.createRestockRequest(pool, adminUserId, {
      supplierId,
      branch: "Maa Branch",
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
    assert.equal(movement.rows[0]?.branch, "Maa Branch");
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
        branch: "Maa Branch",
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
    await pool.end();
  }
});
