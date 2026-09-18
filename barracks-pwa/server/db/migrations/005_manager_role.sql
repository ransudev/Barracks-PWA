INSERT INTO roles (name, description)
VALUES ('manager', 'Can manage day-to-day business operations, inventory, suppliers, reports, bookings, customers, and barbers.')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;
