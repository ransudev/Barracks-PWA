import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("PostgreSQL account, inventory, and barber lifecycle persists safely", { skip: !databaseConfigured }, async () => {
  const { db: pool, cleanup } = await createDisposableSchema();
  const [users, sessions, inventory, inventoryMovements, alerts, barbers, customers, bookings, services] = await Promise.all([
    import("@/server/services/user.service"),
    import("@/server/services/session.service"),
    import("@/server/services/inventory.service"),
    import("@/server/services/inventory-movement.service"),
    import("@/server/services/inventory-alert.service"),
    import("@/server/services/barber.service"),
    import("@/server/services/customer.service"),
    import("@/server/services/booking.service"),
    import("@/server/services/service.service"),
  ]);
  const email = `codex.test.${randomUUID()}@barracks.local`;
  const adminEmail = `codex.admin.${randomUUID()}@barracks.local`;
  let userId: number | null = null;
  let inventoryId: number | null = null;
  let barberId: number | null = null;
  let bookingId: number | null = null;
  let deletableBookingId: number | null = null;
  const serviceId = `codex-test-${randomUUID().slice(0, 8)}`;
  const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  try {
    const createdAdmin = await users.createUser(pool, {
      firstName: "Created",
      lastName: "Administrator",
      email: adminEmail,
      password: "password123",
      role: "administrator",
    });
    assert.equal(createdAdmin.kind, "created");
    if (createdAdmin.kind !== "created") return;
    assert.equal(createdAdmin.user.isVerified, true);
    assert.equal(createdAdmin.user.isBlocked, false);

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
      branch: "Main Branch",
      quantity: 4,
      minimumStock: 2,
      unitCost: 12.5,
    });
    inventoryId = createdItem.id;
    const changedItem = await inventory.updateInventory(pool, inventoryId, {
      name: createdItem.name,
      category: "Products",
      branch: "Main Branch",
      quantity: 0,
      minimumStock: 3,
      unitCost: 15,
    });
    assert.equal(changedItem?.category, "Products");
    assert.equal((await inventory.findInventoryById(pool, inventoryId))?.quantity, 4, "metadata edits must not directly change stock");

    await inventoryMovements.applyInventoryMovement(pool, inventoryId, userId, {
      movementType: "USE",
      quantity: 4,
      supplierId: null,
      unitCost: null,
      reference: "integration-test",
      notes: "Stock changes through movement history",
    });
    assert.equal((await inventory.findInventoryById(pool, inventoryId))?.quantity, 0);
    assert.equal((await alerts.listLowStockAlerts(pool, userId)).some((alert) => alert.itemId === inventoryId), true);
    await alerts.acknowledgeLowStockAlert(pool, inventoryId, userId);
    assert.equal((await alerts.listLowStockAlerts(pool, userId)).some((alert) => alert.itemId === inventoryId), false);
    await inventoryMovements.applyInventoryMovement(pool, inventoryId, userId, {
      movementType: "RECEIVE",
      quantity: 4,
      supplierId: null,
      unitCost: 15,
      reference: "replenishment-test",
      notes: "Replenishment reactivates future alerts",
    });
    await inventoryMovements.applyInventoryMovement(pool, inventoryId, userId, {
      movementType: "CUSTOMER_PURCHASE",
      quantity: 4,
      supplierId: null,
      unitCost: null,
      reference: "reactivation-test",
      notes: "Stock falls below the threshold again",
    });
    assert.equal((await alerts.listLowStockAlerts(pool, userId)).some((alert) => alert.itemId === inventoryId), true);
    await assert.rejects(
      () => inventoryMovements.applyInventoryMovement(pool, inventoryId!, userId!, {
        movementType: "USE",
        quantity: 1,
        supplierId: null,
        unitCost: null,
        reference: "negative-stock-test",
        notes: "Must fail",
      }),
      (error: unknown) => error instanceof Error && error.message === "NEGATIVE_STOCK",
    );

    const createdBarber = await barbers.createBarber(pool, {
      firstName: "Codex",
      lastName: `Barber ${randomUUID().slice(0, 8)}`,
      status: "available",
      commissionRate: 35,
      rating: 4.5,
    });
    barberId = createdBarber.id;
    assert.equal(createdBarber.scheduleDayCount, 7);
    const initialSchedules = await pool.query<{ day_of_week: number; is_working: boolean; start_time: string; end_time: string }>(
      "SELECT day_of_week, is_working, start_time, end_time FROM barber_schedules WHERE barber_id=$1 ORDER BY day_of_week", [barberId],
    );
    assert.deepEqual(initialSchedules.rows.map((row) => row.day_of_week), [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(initialSchedules.rows.every((row) => row.is_working && row.start_time === "09:00:00" && row.end_time === "19:30:00"), true);
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
    });
    assert.equal(rosterEdit?.rating, 4.7);
    assert.equal(rosterEdit?.commissionRate, 40);

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

    const createdService = await services.createService(pool, {
      id: serviceId, name: "Test cut", description: "Testing snapshots", price: 425,
      durationMinutes: 50, active: true,
    });
    assert.equal(createdService.durationMinutes, 50);
    assert.equal((await services.listServices(pool, true)).some((service) => service.id === serviceId), true);
    const createdBooking = await bookings.createBooking(pool, {
      customerId: createdCustomer.customer.id,
      barberId,
      serviceId,
      date: futureDate(14),
      time: "11:00",
      notes: "  Please be gentle  ",
    });
    bookingId = createdBooking.id;
    assert.equal(createdBooking.status, "confirmed");
    assert.equal(createdBooking.serviceName, "Test cut");
    assert.equal(createdBooking.price, 425);
    assert.equal(createdBooking.durationMinutes, 50);
    assert.equal(createdBooking.endTime, "11:50");
    assert.equal(createdBooking.notes, "Please be gentle");
    await services.updateService(pool, serviceId, { name: "Changed cut", price: 500, durationMinutes: 70 });
    const historical = await bookings.findBookingById(pool, bookingId);
    assert.equal(historical?.serviceName, "Test cut");
    assert.equal(historical?.price, 425);
    assert.equal(historical?.durationMinutes, 50);
    assert.equal(historical?.endTime, "11:50");
    assert.equal((await services.updateService(pool, serviceId, { active: false }))?.active, false);
    await assert.rejects(() => bookings.createBooking(pool, { customerId: createdCustomer.customer.id, barberId: barberId!, serviceId, date: futureDate(17), time: "11:00" }),
      (error: unknown) => error instanceof bookings.BookingServiceError && error.kind === "not_found");
    const editedBooking = await bookings.updateBookingDetails(pool, bookingId, {
      customerId: createdCustomer.customer.id,
      barberId,
      serviceId: "signature-shave",
      date: futureDate(15),
      time: "12:00",
    });
    assert.equal(editedBooking?.serviceId, "signature-shave");
    assert.equal(editedBooking?.date, futureDate(15));
    assert.equal(editedBooking?.durationMinutes, 30);
    assert.equal(editedBooking?.endTime, "12:30");
    assert.equal((await bookings.updateBooking(pool, bookingId, { status: "checked_in" }))?.status, "checked_in");
    assert.equal((await bookings.updateBooking(pool, bookingId, { status: "in_progress" }))?.status, "in_progress");
    const completedBooking = await bookings.updateBooking(pool, bookingId, { status: "completed" });
    assert.equal(completedBooking?.status, "completed");
    await assert.rejects(
      () => bookings.updateBooking(pool, bookingId!, { status: "cancelled" }),
      (error: unknown) => error instanceof bookings.BookingServiceError && error.kind === "not_updatable",
    );
    await assert.rejects(
      () => bookings.deleteBooking(pool, bookingId!),
      (error: unknown) => error instanceof bookings.BookingServiceError && error.kind === "not_deletable",
    );
    const deletableBooking = await bookings.createBooking(pool, {
      customerId: createdCustomer.customer.id,
      barberId,
      serviceId: "barracks-basic",
      date: futureDate(16),
      time: "11:00",
    });
    deletableBookingId = deletableBooking.id;
    assert.equal(await bookings.deleteBooking(pool, deletableBookingId), true);
    assert.equal(await bookings.findBookingById(pool, deletableBookingId), null);
  } finally {
    await cleanup();
  }
});
