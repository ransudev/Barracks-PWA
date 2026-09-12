import { z } from "zod";

const money = z.number().finite().min(0).max(9999999999.99);
const positiveInt = z.number().int().positive();

export const supplierSchema = z.object({
  companyName: z.string().trim().min(1).max(180),
  contactPerson: z.string().trim().max(180).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(320).default(""),
  address: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(4000).default(""),
  status: z.enum(["active", "inactive"]).default("active"),
}).strict();

export const supplierAccountSchema = z.object({
  supplierId: positiveInt,
  userId: positiveInt,
}).strict();

export const inventoryMetadataSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.enum(["Supplies", "Equipment", "Products"]),
  supplierId: positiveInt.nullable(),
  unit: z.string().trim().min(1).max(40),
  sku: z.string().trim().max(100).nullable(),
  minimumStock: z.number().int().min(0),
  maximumStock: z.number().int().min(0).nullable(),
  unitCost: money,
  status: z.enum(["active", "inactive"]),
}).strict().refine((data) => data.maximumStock === null || data.maximumStock >= data.minimumStock, {
  path: ["maximumStock"],
  message: "Maximum stock must be at least minimum stock",
});

export const inventoryMovementSchema = z.object({
  movementType: z.enum(["RECEIVE", "USE", "DAMAGE", "RETURN", "ADJUSTMENT"]),
  quantity: positiveInt,
  supplierId: positiveInt.nullable().optional(),
  unitCost: money.nullable().optional(),
  reference: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(4000).default(""),
  adjustmentDirection: z.enum(["increase", "decrease"]).optional(),
}).strict();

export const restockCreateSchema = z.object({
  supplierId: positiveInt,
  reference: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(4000).default(""),
  items: z.array(z.object({
    inventoryItemId: positiveInt,
    requestedQuantity: positiveInt,
    unitCost: money.nullable().optional(),
  }).strict()).min(1),
}).strict();

export const restockStatusSchema = z.object({
  status: z.enum(["Pending", "Accepted", "Preparing", "Shipped", "Delivered", "Cancelled"]),
}).strict();

export const receiveRestockSchema = z.object({
  reference: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(4000).default(""),
  items: z.array(z.object({
    restockRequestItemId: positiveInt,
    deliveredQuantity: z.number().int().min(0),
    unitCost: money.nullable().optional(),
  }).strict()).min(1),
}).strict();

export type SupplierInput = z.infer<typeof supplierSchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;
export type RestockCreateInput = z.infer<typeof restockCreateSchema>;
export type RestockStatusInput = z.infer<typeof restockStatusSchema>;
export type ReceiveRestockInput = z.infer<typeof receiveRestockSchema>;
