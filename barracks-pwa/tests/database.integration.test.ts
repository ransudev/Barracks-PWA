import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

test("PostgreSQL account, inventory, and barber lifecycle persists safely", { skip: !databaseConfigured }, async () => {
  const [{ pool }, users, sessions, inventory, barbers, customers] = await Promise.all([
    import("@/server/db/pool"),
    import("@/server/services/user.service"),
    import("@/server/services/session.service"),
    import("@/server/services/inventory.service"),
    import("@/server/services/barber.service"),
    import("@/server/services/customer.service"),
  ]);
  const email = `codex.test.${randomUUID()}@barracks.local`;
  let userId: number | null = null;
  let inventoryId: number | null = null;
  let barberId: number | null = null;
  let customerUserId: number | null = null;

  try {
    const created = await users.createUser(pool, {
      firstName: "Lifecycle",
      lastName: "Test",
      email,
      password: "password123",
      role: "front_desk",
    });
    assert.equal(created.kind, "created");
    if (created.kind !== "created") return;
    userId = created.user.id;
    assert.equal(created.user.isVerified, false);
    assert.equal(created.user.isBlocked, false);
    assert.equal("password" in created.user, false);
    assert.equal("passwordHash" in created.user, false);

    const updated = await users.updateStaffUser(pool, userId, {
      firstName: "Updated",
      lastName: "Lifecycle",
      email,
      role: "front_desk",
    });
    assert.equal(updated.kind, "updated");

    const verified = await users.updateUserLifecycle(pool, userId, { action: "verify" });
    assert.equal(verified.kind, "updated");
    if (verified.kind !== "updated") return;
    assert.equal(verified.user.isVerified, true);

    const session = await sessions.createSession(pool, userId);
    const blocked = await users.updateUserLifecycle(pool, userId, { action: "block" });
    assert.equal(blocked.kind, "updated");
    assert.equal(await sessions.findUserBySessionToken(pool, session.token), null);

    const unblocked = await users.updateUserLifecycle(pool, userId, { action: "unblock" });
    assert.equal(unblocked.kind, "updated");
    if (unblocked.kind !== "updated") return;
    assert.equal(unblocked.user.isBlocked, false);
    const restoredSession = await sessions.createSession(pool, userId);
    assert.equal((await sessions.findUserBySessionToken(pool, restoredSession.token))?.id, userId);

    const duplicate = await users.createUser(pool, {
      firstName: "Duplicate",
      lastName: "Lifecycle",
      email,
      password: "password123",
      role: "front_desk",
    });
    assert.equal(duplicate.kind, "duplicate");

    const createdItem = await inventory.createInventory(pool, {
      name: `Codex test item ${randomUUID()}`,
      category: "Supplies",
      quantity: 4,
      minimumStock: 2,
      unitCost: 12.5,
    });
    inventoryId = createdItem.id;
    const changedItem = await inventory.updateInventory(pool, inventoryId, {
      name: createdItem.name,
      category: "Products",
      quantity: 0,
      minimumStock: 3,
      unitCost: 15,
    });
    assert.equal(changedItem?.category, "Products");
    assert.equal((await inventory.findInventoryById(pool, inventoryId))?.quantity, 0);

    const createdBarber = await barbers.createBarber(pool, {
      firstName: "Codex",
      lastName: `Barber ${randomUUID().slice(0, 8)}`,
      status: "available",
      commissionRate: 35,
      rating: 4.5,
    });
    barberId = createdBarber.id;
    const changedBarber = await barbers.updateBarber(pool, barberId, {
      firstName: createdBarber.firstName,
      lastName: createdBarber.lastName,
      status: "busy",
      commissionRate: 40,
      rating: 4.7,
    });
    assert.equal(changedBarber?.status, "busy");
    assert.equal(changedBarber?.rating, 4.7);
    const rosterEdit = await barbers.updateBarber(pool, barberId, {
      firstName: changedBarber!.firstName,
      lastName: changedBarber!.lastName,
      status: "available",
      commissionRate: 40,
    });
    assert.equal(rosterEdit?.rating, 4.7);

    const createdCustomer = await customers.createCustomer(pool, {
      firstName: "Codex",
      lastName: `Customer ${randomUUID().slice(0, 8)}`,
      email: `codex.customer.${randomUUID()}@barracks.local`,
      password: "password123",
      phone: "09000000000",
      preferredBarberId: barberId,
    });
    assert.equal(createdCustomer.kind, "created");
    if (createdCustomer.kind !== "created") return;
    customerUserId = createdCustomer.customer.userId;
    const changedCustomer = await customers.updateCustomer(pool, createdCustomer.customer.id, {
      firstName: createdCustomer.customer.firstName,
      lastName: createdCustomer.customer.lastName,
      email: createdCustomer.customer.email,
      phone: createdCustomer.customer.phone,
      preferredBarberId: createdCustomer.customer.preferredBarberId,
      loyaltyPoints: 125,
    });
    assert.equal(changedCustomer?.loyaltyPoints, 125);
    assert.equal((await customers.findCustomerById(pool, createdCustomer.customer.id))?.loyaltyPoints, 125);
    const contactOnlyEdit = await customers.updateCustomer(pool, createdCustomer.customer.id, {
      firstName: createdCustomer.customer.firstName,
      lastName: createdCustomer.customer.lastName,
      email: createdCustomer.customer.email,
      phone: "09000000001",
      preferredBarberId: createdCustomer.customer.preferredBarberId,
    });
    assert.equal(contactOnlyEdit?.loyaltyPoints, 125);
  } finally {
    if (barberId) await pool.query("DELETE FROM barbers WHERE id = $1", [barberId]);
    if (inventoryId) await pool.query("DELETE FROM inventory_items WHERE id = $1", [inventoryId]);
    if (customerUserId) await pool.query("DELETE FROM users WHERE id = $1", [customerUserId]);
    if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await pool.end();
  }
});
