import type { PoolClient } from "pg";
import { pool } from "../server/db/pool";
import { hashPassword } from "../server/services/password.service";

const demoFrontDesk = {
  firstName: "Mara",
  lastName: "Santos",
  email: "demo.frontdesk@barracks.local",
  password: "frontdesk123",
  role: "front_desk",
} as const;

const demoSuppliers = [
  {
    key: "northstar",
    companyName: "Northstar Grooming Supply",
    contactPerson: "Nina Ramos",
    phone: "+63 917 555 0201",
    email: "northstar@barracks.local",
    address: "J.P. Laurel Avenue, Davao City",
    notes: "Consumables and daily shop supplies.",
    status: "active",
    account: {
      firstName: "Nina",
      lastName: "Ramos",
      email: "demo.supplier.nina@barracks.local",
      password: "supplier123",
    },
  },
  {
    key: "davao-essentials",
    companyName: "Davao Barber Essentials",
    contactPerson: "Marco Villanueva",
    phone: "+63 917 555 0202",
    email: "essentials@barracks.local",
    address: "Ecoland Drive, Davao City",
    notes: "Tools, equipment, and retail grooming products.",
    status: "active",
    account: {
      firstName: "Marco",
      lastName: "Villanueva",
      email: "demo.supplier.marco@barracks.local",
      password: "supplier123",
    },
  },
] as const;

const demoCustomers = [
  {
    firstName: "Ana",
    lastName: "Mercado",
    email: "demo.customer.ana@barracks.local",
    phone: "+63 917 555 0101",
    preferredBarber: "Miko Reyes",
    loyaltyPoints: 180,
  },
  {
    firstName: "Paulo",
    lastName: "Lim",
    email: "demo.customer.paulo@barracks.local",
    phone: "+63 917 555 0102",
    preferredBarber: "Paolo Santos",
    loyaltyPoints: 95,
  },
  {
    firstName: "Samira",
    lastName: "Cruz",
    email: "demo.customer.samira@barracks.local",
    phone: "+63 917 555 0103",
    preferredBarber: null,
    loyaltyPoints: 40,
  },
  {
    firstName: "Jethro",
    lastName: "Dizon",
    email: "demo.customer.jethro@barracks.local",
    phone: "+63 917 555 0104",
    preferredBarber: "Andrei Villanueva",
    loyaltyPoints: 260,
  },
] as const;

const demoBarbers = [
  { firstName: "Miko", lastName: "Reyes", status: "available", commissionRate: 45, servicesDone: 45, revenue: 1245, rating: 4.8 },
  { firstName: "Paolo", lastName: "Santos", status: "busy", commissionRate: 50, servicesDone: 38, revenue: 890, rating: 4.6 },
  { firstName: "Luis", lastName: "Dela Cruz", status: "unavailable", commissionRate: 40, servicesDone: 22, revenue: 350, rating: 4.5 },
  { firstName: "Andrei", lastName: "Villanueva", status: "available", commissionRate: 55, servicesDone: 31, revenue: 720, rating: 4.7 },
] as const;

const demoInventory = [
  { key: "neck-strips", name: "Neck strips", category: "Supplies", quantity: 480, minimumStock: 120, maximumStock: 1000, unitCost: 0.75, unit: "pack", sku: "NS-NECK-001", supplierKey: "northstar" },
  { key: "disinfectant", name: "Disinfectant spray", category: "Supplies", quantity: 9, minimumStock: 12, maximumStock: 30, unitCost: 280, unit: "bottle", sku: "NS-DIS-001", supplierKey: "northstar" },
  { key: "aftershave", name: "Aftershave balm", category: "Products", quantity: 14, minimumStock: 8, maximumStock: 30, unitCost: 450, unit: "bottle", sku: "NS-AFT-001", supplierKey: "northstar" },
  { key: "capes", name: "Barber capes", category: "Supplies", quantity: 24, minimumStock: 12, maximumStock: 40, unitCost: 420, unit: "piece", sku: "DBE-CAP-001", supplierKey: "davao-essentials" },
  { key: "matte-clay", name: "Matte clay", category: "Products", quantity: 7, minimumStock: 10, maximumStock: 30, unitCost: 380, unit: "jar", sku: "DBE-CLY-001", supplierKey: "davao-essentials" },
  { key: "clippers", name: "Cordless clippers", category: "Equipment", quantity: 6, minimumStock: 3, maximumStock: 10, unitCost: 7800, unit: "piece", sku: "DBE-CLI-001", supplierKey: "davao-essentials" },
  { key: "steamer", name: "Hot towel steamer", category: "Equipment", quantity: 2, minimumStock: 1, maximumStock: 4, unitCost: 6200, unit: "piece", sku: "DBE-STE-001", supplierKey: "davao-essentials" },
] as const;

const demoBookings = [
  {
    demoKey: "demo-ana-basic",
    customerEmail: "demo.customer.ana@barracks.local",
    barberName: "Miko Reyes",
    serviceId: "barracks-basic",
    serviceName: "Barracks Basic",
    servicePrice: 300,
    dayOffset: 1,
    time: "10:00",
    status: "upcoming",
  },
  {
    demoKey: "demo-paulo-shave",
    customerEmail: "demo.customer.paulo@barracks.local",
    barberName: "Paolo Santos",
    serviceId: "signature-shave",
    serviceName: "Signature Shave",
    servicePrice: 300,
    dayOffset: 2,
    time: "14:00",
    status: "upcoming",
  },
  {
    demoKey: "demo-samira-premium",
    customerEmail: "demo.customer.samira@barracks.local",
    barberName: "Andrei Villanueva",
    serviceId: "barracks-premium",
    serviceName: "Barracks Premium",
    servicePrice: 550,
    dayOffset: -4,
    time: "11:30",
    status: "completed",
  },
  {
    demoKey: "demo-jethro-cancelled",
    customerEmail: "demo.customer.jethro@barracks.local",
    barberName: "Miko Reyes",
    serviceId: "barracks-basic",
    serviceName: "Barracks Basic",
    servicePrice: 300,
    dayOffset: -2,
    time: "15:00",
    status: "cancelled",
  },
] as const;

const demoRestocks = [
  {
    key: "demo-restock-pending",
    supplierKey: "northstar",
    status: "Pending",
    reference: "NS-REQ-2026-001",
    notes: "Weekly consumables top-up.",
    itemKey: "disinfectant",
    requestedQuantity: 18,
    deliveredQuantity: null,
    unitCost: 260,
  },
  {
    key: "demo-restock-delivered",
    supplierKey: "davao-essentials",
    status: "Delivered",
    reference: "DBE-REQ-2026-004",
    notes: "Awaiting front-desk receiving count.",
    itemKey: "matte-clay",
    requestedQuantity: 15,
    deliveredQuantity: null,
    unitCost: 350,
  },
  {
    key: "demo-restock-received",
    supplierKey: "northstar",
    status: "Received",
    reference: "NS-REQ-2026-000",
    notes: "All units received and checked in.",
    itemKey: "neck-strips",
    requestedQuantity: 200,
    deliveredQuantity: 200,
    unitCost: 0.7,
  },
] as const;

const demoTransactions = [
  { bookingKey: "demo-samira-premium", paymentMethod: "card", status: "completed" },
] as const;

type DatabaseClient = PoolClient;

async function roleId(client: DatabaseClient, role: string): Promise<number> {
  const result = await client.query<{ id: number }>("SELECT id FROM roles WHERE name = $1 LIMIT 1", [role]);
  if (!result.rows[0]) throw new Error(`Role ${role} is missing; run npm run db:migrate first`);
  return result.rows[0].id;
}

async function createUser(
  client: DatabaseClient,
  input: { firstName: string; lastName: string; email: string; password: string; role: string },
): Promise<number> {
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO users (first_name,last_name,email,password_hash,role_id,is_verified,is_blocked)
     VALUES ($1,$2,$3,$4,$5,TRUE,FALSE) RETURNING id`,
    [input.firstName, input.lastName, input.email, await hashPassword(input.password), await roleId(client, input.role)],
  );
  return Number(inserted.rows[0].id);
}

async function clearBusinessData(client: DatabaseClient): Promise<void> {
  await client.query("DELETE FROM transactions");
  await client.query("DELETE FROM restock_requests");
  await client.query("DELETE FROM inventory_movements");
  await client.query("DELETE FROM bookings");
  await client.query("DELETE FROM customers");
  await client.query("DELETE FROM supplier_accounts");
  await client.query("DELETE FROM inventory_items");
  await client.query("DELETE FROM barbers");
  await client.query("DELETE FROM suppliers");
  await client.query("DELETE FROM services");
  await client.query("DELETE FROM users WHERE role_id <> (SELECT id FROM roles WHERE name = 'administrator')");
}

async function seedServices(client: DatabaseClient): Promise<void> {
  await client.query(
    `INSERT INTO services (id,name,current_price,active) VALUES
      ('barracks-basic','Barracks Basic',300,TRUE),
      ('signature-shave','Signature Shave',300,TRUE),
      ('barracks-premium','Barracks Premium',550,TRUE)`,
  );
}

async function seedBarbers(client: DatabaseClient): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const barber of demoBarbers) {
    const result = await client.query<{ id: number }>(
      `INSERT INTO barbers (first_name,last_name,status,commission_rate,services_done,revenue,rating)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [barber.firstName, barber.lastName, barber.status, barber.commissionRate, barber.servicesDone, barber.revenue, barber.rating],
    );
    ids.set(`${barber.firstName} ${barber.lastName}`, Number(result.rows[0].id));
  }
  return ids;
}

async function seedSuppliers(client: DatabaseClient): Promise<Map<string, { id: number; userId: number }>> {
  const ids = new Map<string, { id: number; userId: number }>();
  for (const entry of demoSuppliers) {
    const supplierResult = await client.query<{ id: number }>(
      `INSERT INTO suppliers (company_name,contact_person,phone,email,address,notes,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [entry.companyName, entry.contactPerson, entry.phone, entry.email, entry.address, entry.notes, entry.status],
    );
    const supplierId = Number(supplierResult.rows[0].id);
    const userId = await createUser(client, { ...entry.account, role: "supplier" });
    await client.query("INSERT INTO supplier_accounts (user_id,supplier_id) VALUES ($1,$2)", [userId, supplierId]);
    ids.set(entry.key, { id: supplierId, userId });
  }
  return ids;
}

async function seedInventory(
  client: DatabaseClient,
  suppliers: Map<string, { id: number; userId: number }>,
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const item of demoInventory) {
    const supplier = suppliers.get(item.supplierKey);
    if (!supplier) throw new Error(`Unable to resolve inventory supplier ${item.supplierKey}`);
    const result = await client.query<{ id: number }>(
      `INSERT INTO inventory_items
        (name,category,quantity,minimum_stock,maximum_stock,unit_cost,unit,sku,status,supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9) RETURNING id`,
      [item.name, item.category, item.quantity, item.minimumStock, item.maximumStock, item.unitCost, item.unit, item.sku, supplier.id],
    );
    ids.set(item.key, Number(result.rows[0].id));
  }
  return ids;
}

async function seedCustomers(client: DatabaseClient, barbers: Map<string, number>): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const customer of demoCustomers) {
    const userId = await createUser(client, { ...customer, password: "customer123", role: "customer" });
    const preferredBarberId = customer.preferredBarber ? barbers.get(customer.preferredBarber) ?? null : null;
    const result = await client.query<{ id: number }>(
      `INSERT INTO customers (user_id,phone,preferred_barber_id,loyalty_points)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [userId, customer.phone, preferredBarberId, customer.loyaltyPoints],
    );
    ids.set(customer.email, Number(result.rows[0].id));
  }
  return ids;
}

async function seedBookings(
  client: DatabaseClient,
  customers: Map<string, number>,
  barbers: Map<string, number>,
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const booking of demoBookings) {
    const customerId = customers.get(booking.customerEmail);
    const barberId = barbers.get(booking.barberName);
    if (!customerId || !barberId) throw new Error(`Unable to resolve booking ${booking.demoKey}`);
    const result = await client.query<{ id: number }>(
      `INSERT INTO bookings
        (customer_id,barber_id,service_id,service_name,service_price,booking_date,booking_time,status,demo_key)
       VALUES ($1,$2,$3,$4,$5,CURRENT_DATE + $6::integer,$7,$8,$9) RETURNING id`,
      [customerId, barberId, booking.serviceId, booking.serviceName, booking.servicePrice, booking.dayOffset, booking.time, booking.status, booking.demoKey],
    );
    ids.set(booking.demoKey, Number(result.rows[0].id));
  }
  return ids;
}

async function seedRestocks(
  client: DatabaseClient,
  adminUserId: number,
  suppliers: Map<string, { id: number; userId: number }>,
  inventory: Map<string, number>,
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const restock of demoRestocks) {
    const supplier = suppliers.get(restock.supplierKey);
    const inventoryItemId = inventory.get(restock.itemKey);
    if (!supplier || !inventoryItemId) throw new Error(`Unable to resolve restock ${restock.key}`);
    const received = restock.status === "Received";
    const requestResult = await client.query<{ id: number }>(
      `INSERT INTO restock_requests
        (supplier_id,status,reference,notes,requested_by,received_by,received_at)
       VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $7 THEN NOW() ELSE NULL END) RETURNING id`,
      [supplier.id, restock.status, restock.reference, restock.notes, adminUserId, received ? adminUserId : null, received],
    );
    const restockId = Number(requestResult.rows[0].id);
    await client.query(
      `INSERT INTO restock_request_items
        (restock_request_id,inventory_item_id,requested_quantity,delivered_quantity,unit_cost)
       VALUES ($1,$2,$3,$4,$5)`,
      [restockId, inventoryItemId, restock.requestedQuantity, restock.deliveredQuantity, restock.unitCost],
    );
    ids.set(restock.key, restockId);

    if (received && restock.deliveredQuantity) {
      const item = demoInventory.find((candidate) => candidate.key === restock.itemKey);
      if (!item) throw new Error(`Unable to resolve received inventory ${restock.itemKey}`);
      const previousStock = item.quantity - restock.deliveredQuantity;
      if (previousStock < 0) throw new Error(`Received quantity exceeds seeded stock for ${restock.itemKey}`);
      await client.query(
        `INSERT INTO inventory_movements
          (inventory_item_id,supplier_id,movement_type,quantity,previous_stock,new_stock,unit_cost,reference,notes,created_by)
         VALUES ($1,$2,'RECEIVE',$3,$4,$5,$6,$7,$8,$9)`,
        [inventoryItemId, supplier.id, restock.deliveredQuantity, previousStock, item.quantity, restock.unitCost, restock.reference, restock.notes, adminUserId],
      );
    }
  }
  return ids;
}

async function seedTransactions(client: DatabaseClient, bookings: Map<string, number>, customers: Map<string, number>, barbers: Map<string, number>): Promise<void> {
  const completedBooking = demoBookings.find((booking) => booking.demoKey === "demo-samira-premium");
  const bookingId = bookings.get("demo-samira-premium");
  const customerId = completedBooking ? customers.get(completedBooking.customerEmail) : undefined;
  const barberId = completedBooking ? barbers.get(completedBooking.barberName) : undefined;
  if (!completedBooking || !bookingId || !customerId || !barberId) throw new Error("Unable to resolve demo transaction");
  for (const transaction of demoTransactions) {
    await client.query(
      `INSERT INTO transactions (customer_id,booking_id,barber_id,service_id,amount,payment_method,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [customerId, bookingId, barberId, completedBooking.serviceId, completedBooking.servicePrice, transaction.paymentMethod, transaction.status],
    );
  }
}

async function seedDemoData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const adminResult = await client.query<{ id: number }>(
      `SELECT u.id FROM users u INNER JOIN roles r ON r.id=u.role_id
       WHERE r.name='administrator' AND u.deleted_at IS NULL ORDER BY u.id LIMIT 1`,
    );
    if (!adminResult.rows[0]) throw new Error("No administrator found; run npm run db:seed-admin first");
    const adminUserId = Number(adminResult.rows[0].id);

    await clearBusinessData(client);
    await seedServices(client);
    const barbers = await seedBarbers(client);
    const suppliers = await seedSuppliers(client);
    const inventory = await seedInventory(client, suppliers);
    const customers = await seedCustomers(client, barbers);
    const bookings = await seedBookings(client, customers, barbers);
    await seedRestocks(client, adminUserId, suppliers, inventory);
    await seedTransactions(client, bookings, customers, barbers);
    await createUser(client, demoFrontDesk);

    await client.query("COMMIT");
    console.log("Sprint 2 demo data replaced: 4 barbers, 7 inventory items, 2 suppliers, 4 customers, 4 bookings, 3 restocks, 1 movement, 1 transaction, 1 front-desk account, and 2 supplier accounts");
    console.log("Front Desk login: demo.frontdesk@barracks.local / frontdesk123");
    console.log("Supplier logins: demo.supplier.nina@barracks.local / supplier123 and demo.supplier.marco@barracks.local / supplier123");
    console.log("Customer login: demo.customer.ana@barracks.local / customer123");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoData().catch((error) => {
  console.error("Sprint 2 demo data seed failed", error);
  process.exitCode = 1;
});
