import { z } from "zod";
import { formatValidationErrors } from "@/server/schemas/user.schema";

export { formatValidationErrors };

export const barberStatusSchema = z.enum(["available", "busy", "unavailable"]);
export const inventoryCategorySchema = z.enum(["Supplies", "Equipment", "Products"]);
export const bookingStatusSchema = z.enum(["upcoming", "completed", "cancelled"]);

const bookingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid booking date")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Choose a valid booking date");

const bookingTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid booking time");

export const barberSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    status: barberStatusSchema,
    commissionRate: z.number().min(0).max(100).nullable(),
  })
  .strict();

export const inventoryItemSchema = z
  .object({
    name: z.string().trim().min(1, "Item name is required").max(160),
    category: inventoryCategorySchema,
    quantity: z.number().int().min(0),
    minimumStock: z.number().int().min(0),
    unitCost: z.number().min(0),
  })
  .strict();

export const bookingCreateSchema = z
  .object({
    customerId: z.number().int().positive().optional(),
    barberId: z.number().int().positive(),
    serviceId: z.string().trim().min(1).max(80),
    date: bookingDateSchema,
    time: bookingTimeSchema,
  })
  .strict();

export const bookingUpdateSchema = z
  .object({
    status: bookingStatusSchema,
  })
  .strict();

export const customerSignupSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    phone: z.string().trim().max(40).default(""),
    preferredBarberId: z.number().int().positive().nullable().default(null),
  })
  .strict();

export const customerProfileSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
    phone: z.string().trim().max(40),
    preferredBarberId: z.number().int().positive().nullable(),
  })
  .strict();

export type BarberInput = z.infer<typeof barberSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;
