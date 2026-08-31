import { pool } from "../server/db/pool";
import { hashPassword } from "../server/services/password.service";
import type { PoolClient } from "pg";

const demoFrontDesk = {
  firstName: "Mara",
  lastName: "Santos",
  email: "demo.frontdesk@barracks.local",
  password: "frontdesk123",
  role: "front_desk",
} as const;

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
  { firstName: "Miko", lastName: "Reyes", specialty: "Classic cuts + fades", status: "available", commissionRate: 45 },
  { firstName: "Paolo", lastName: "Santos", specialty: "Beard shaping + hot towel shaves", status: "busy", commissionRate: 50 },
  { firstName: "Luis", lastName: "Dela Cruz", specialty: "Modern styling + texture", status: "unavailable", commissionRate: 40 },
  { firstName: "Andrei", lastName: "Villanueva", specialty: "Traditional cuts + styling", status: "available", commissionRate: 55 },
] as const;

const demoInventory = [
  { name: "Neck strips", category: "Supplies", quantity: 480, minimumStock: 120, unitCost: 0.75 },
  { name: "Barber capes", category: "Supplies", quantity: 18, minimumStock: 12, unitCost: 420 },
  { name: "Matte clay", category: "Products", quantity: 7, minimumStock: 10, unitCost: 380 },
  { name: "Aftershave balm", category: "Products", quantity: 0, minimumStock: 8, unitCost: 450 },
  { name: "Cordless clippers", category: "Equipment", quantity: 6, minimumStock: 3, unitCost: 7800 },
  { name: "Hot towel steamer", category: "Equipment", quantity: 2, minimumStock: 1, unitCost: 6200 },
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
] as const;

type DatabaseClient = PoolClient;

async function roleId(client: DatabaseClient, role: string): Promise<number> {
  const result = await client.query<{ id: number }>(
    "SELECT id FROM roles WHERE name = $1 LIMIT 1",
    [role],
  );

  if (!result.rows[0]) {
    throw new Error(`Role ${role} is missing; run npm run db:migrate first`);
  }

  return result.rows[0].id;
}

async function upsertUser(
  client: DatabaseClient,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
  },
): Promise<number> {
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [input.email],
  );
  const passwordHash = await hashPassword(input.password);
  const selectedRoleId = await roleId(client, input.role);

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE users
        SET first_name = $1, last_name = $2, password_hash = $3,
            role_id = $4, updated_at = NOW()
        WHERE id = $5
      `,
      [input.firstName, input.lastName, passwordHash, selectedRoleId, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query<{ id: number }>(
    `
      INSERT INTO users (first_name, last_name, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [input.firstName, input.lastName, input.email, passwordHash, selectedRoleId],
  );

  return inserted.rows[0].id;
}

async function upsertBarber(
  client: DatabaseClient,
  barber: (typeof demoBarbers)[number],
): Promise<number> {
  const existing = await client.query<{ id: number }>(
    `
      SELECT id FROM barbers
      WHERE first_name = $1 AND last_name = $2
      LIMIT 1
    `,
    [barber.firstName, barber.lastName],
  );

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE barbers
        SET specialty = $1, status = $2, commission_rate = $3, updated_at = NOW()
        WHERE id = $4
      `,
      [barber.specialty, barber.status, barber.commissionRate, existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query<{ id: number }>(
    `
      INSERT INTO barbers (first_name, last_name, specialty, status, commission_rate)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [barber.firstName, barber.lastName, barber.specialty, barber.status, barber.commissionRate],
  );

  return inserted.rows[0].id;
}

async function upsertInventory(
  client: DatabaseClient,
  item: (typeof demoInventory)[number],
): Promise<void> {
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM inventory_items WHERE name = $1 LIMIT 1",
    [item.name],
  );

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE inventory_items
        SET category = $1, quantity = $2, minimum_stock = $3,
            unit_cost = $4, updated_at = NOW()
        WHERE id = $5
      `,
      [item.category, item.quantity, item.minimumStock, item.unitCost, existing.rows[0].id],
    );
    return;
  }

  await client.query(
    `
      INSERT INTO inventory_items (name, category, quantity, minimum_stock, unit_cost)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [item.name, item.category, item.quantity, item.minimumStock, item.unitCost],
  );
}

async function upsertBooking(
  client: DatabaseClient,
  booking: (typeof demoBookings)[number],
  customerIds: Map<string, number>,
  barberIds: Map<string, number>,
): Promise<void> {
  const customerId = customerIds.get(booking.customerEmail);
  const barberId = barberIds.get(booking.barberName);
  if (!customerId || !barberId) throw new Error(`Unable to resolve demo booking ${booking.demoKey}`);

  const existing = await client.query<{ id: number }>(
    "SELECT id FROM bookings WHERE demo_key = $1 LIMIT 1",
    [booking.demoKey],
  );
  const values = [
    customerId,
    barberId,
    booking.serviceId,
    booking.serviceName,
    booking.servicePrice,
    booking.dayOffset,
    booking.time,
    booking.status,
    booking.demoKey,
  ];

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE bookings
        SET customer_id = $1, barber_id = $2, service_id = $3, service_name = $4,
            service_price = $5, booking_date = CURRENT_DATE + $6::integer,
            booking_time = $7, status = $8, updated_at = NOW()
        WHERE demo_key = $9
      `,
      values,
    );
    return;
  }

  await client.query(
    `
      INSERT INTO bookings
        (customer_id, barber_id, service_id, service_name, service_price,
         booking_date, booking_time, status, demo_key)
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + $6::integer, $7, $8, $9)
    `,
    values,
  );
}

async function seedDemoData() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await upsertUser(client, demoFrontDesk);

    const barberIds = new Map<string, number>();
    for (const barber of demoBarbers) {
      const id = await upsertBarber(client, barber);
      barberIds.set(`${barber.firstName} ${barber.lastName}`, id);
    }

    for (const item of demoInventory) {
      await upsertInventory(client, item);
    }

    const customerIds = new Map<string, number>();
    for (const customer of demoCustomers) {
      const userId = await upsertUser(client, {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        password: "customer123",
        role: "customer",
      });
      const preferredBarberId = customer.preferredBarber
        ? barberIds.get(customer.preferredBarber) ?? null
        : null;

      await client.query(
        `
          INSERT INTO customers (user_id, phone, preferred_barber_id, loyalty_points)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id) DO UPDATE
          SET phone = EXCLUDED.phone,
              preferred_barber_id = EXCLUDED.preferred_barber_id,
              loyalty_points = EXCLUDED.loyalty_points,
              updated_at = NOW()
        `,
        [userId, customer.phone, preferredBarberId, customer.loyaltyPoints],
      );
      const customerRecord = await client.query<{ id: number }>(
        "SELECT id FROM customers WHERE user_id = $1 LIMIT 1",
        [userId],
      );
      if (customerRecord.rows[0]) customerIds.set(customer.email, customerRecord.rows[0].id);
    }

    for (const booking of demoBookings) {
      await upsertBooking(client, booking, customerIds, barberIds);
    }

    await client.query("COMMIT");
    console.log("Demo data seeded: 4 barbers, 6 inventory items, 4 customers, 2 bookings, 1 front-desk account");
    console.log("Front Desk login: demo.frontdesk@barracks.local / frontdesk123");
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
  console.error("Demo data seed failed", error);
  process.exitCode = 1;
});
