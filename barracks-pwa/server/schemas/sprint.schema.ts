import { z } from "zod";
import { formatValidationErrors } from "@/server/schemas/user.schema";

export { formatValidationErrors };

export const barberStatusSchema = z.enum(["available", "busy", "unavailable"]);
export const inventoryCategorySchema = z.enum(["Supplies", "Equipment", "Products"]);

export const barberSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    specialty: z.string().trim().min(1, "Specialty is required").max(160),
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
export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;
