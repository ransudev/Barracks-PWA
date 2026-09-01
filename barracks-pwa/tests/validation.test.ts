import assert from "node:assert/strict";
import test from "node:test";
import { createStaffUserSchema, userLifecycleSchema, updateStaffUserSchema } from "@/server/schemas/user.schema";
import { barberSchema, barberStaffSchema, customerProfileSchema, customerSelfProfileSchema, inventoryItemSchema } from "@/server/schemas/sprint.schema";

test("staff account schemas are strict and validate lifecycle input", () => {
  const valid = createStaffUserSchema.safeParse({
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    password: "password123",
    role: "front_desk",
  });
  assert.equal(valid.success, true);

  assert.equal(createStaffUserSchema.safeParse({
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    password: "password123",
    role: "front_desk",
    isBlocked: true,
  }).success, false);
  assert.equal(updateStaffUserSchema.safeParse({
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    role: "front_desk",
  }).success, true);
  assert.equal(userLifecycleSchema.safeParse({ action: "block", extra: true }).success, false);
  assert.equal(userLifecycleSchema.safeParse({ action: "unblock" }).success, true);
});

test("inventory and barber schemas reject unsafe values", () => {
  assert.equal(inventoryItemSchema.safeParse({
    name: "Neck strips",
    category: "Unknown",
    quantity: 1,
    minimumStock: 1,
    unitCost: 1,
  }).success, false);
  assert.equal(inventoryItemSchema.safeParse({
    name: "Neck strips",
    category: "Supplies",
    quantity: -1,
    minimumStock: 1,
    unitCost: 1,
  }).success, false);
  assert.equal(inventoryItemSchema.safeParse({
    name: "Neck strips",
    category: "Supplies",
    quantity: 1,
    minimumStock: 1,
    unitCost: 1.001,
  }).success, false);
  assert.equal(barberSchema.safeParse({
    firstName: "Miko",
    lastName: "Reyes",
    status: "available",
    commissionRate: 101,
  }).success, false);
  assert.equal(barberSchema.safeParse({
    firstName: "Miko",
    lastName: "Reyes",
    status: "available",
    commissionRate: 45.25,
    rating: 4.8,
  }).success, true);
  assert.equal(barberSchema.safeParse({
    firstName: "Miko",
    lastName: "Reyes",
    status: "available",
    commissionRate: 45.25,
    rating: 5.1,
  }).success, false);
  assert.equal(barberStaffSchema.safeParse({
    firstName: "Miko",
    lastName: "Reyes",
    status: "available",
    commissionRate: 45.25,
    rating: 4.8,
  }).success, false);
  assert.equal(barberStaffSchema.safeParse({
    firstName: "Miko",
    lastName: "Reyes",
    status: "available",
    commissionRate: 45.25,
    servicesDone: 20,
  }).success, false);
  assert.equal(customerProfileSchema.safeParse({
    firstName: "Test",
    lastName: "Customer",
    email: "customer@example.com",
    phone: "",
    preferredBarberId: null,
    loyaltyPoints: 100,
  }).success, true);
  assert.equal(customerProfileSchema.safeParse({
    firstName: "Test",
    lastName: "Customer",
    email: "customer@example.com",
    phone: "",
    preferredBarberId: null,
    loyaltyPoints: -1,
  }).success, false);
  assert.equal(customerSelfProfileSchema.safeParse({
    firstName: "Test",
    lastName: "Customer",
    email: "customer@example.com",
    phone: "",
    preferredBarberId: null,
    loyaltyPoints: 100,
  }).success, false);
});
