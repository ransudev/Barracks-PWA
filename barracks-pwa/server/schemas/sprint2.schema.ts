import { z } from "zod";

const money = z.number().finite().min(0).max(9999999999.99);
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().min(0).max(2147483647);

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

const inventoryMetadataShape = {
  name: z.string().trim().min(1).max(160),
  category: z.enum(["Supplies", "Equipment", "Products"]),
  supplierId: positiveInt.nullable(),
  unit: z.string().trim().min(1).max(40),
  sku: z.string().trim().max(100).nullable(),
  minimumStock: nonNegativeInt,
  maximumStock: nonNegativeInt.nullable(),
  unitCost: money,
  status: z.enum(["active", "inactive"]),
} as const;

function maximumStockIsValid(data: { minimumStock: number; maximumStock: number | null }): boolean {
  return data.maximumStock === null || data.maximumStock >= data.minimumStock;
}

export const inventoryMetadataSchema = z.object(inventoryMetadataShape).strict().refine(maximumStockIsValid, {
  path: ["maximumStock"],
  message: "Maximum stock must be at least minimum stock",
});

export const inventoryCreateSchema = z.object({
  ...inventoryMetadataShape,
  initialQuantity: nonNegativeInt.default(0),
}).strict().refine(maximumStockIsValid, {
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
}).strict().superRefine((data, ctx) => {
  if (data.movementType === "ADJUSTMENT" && !data.adjustmentDirection) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["adjustmentDirection"], message: "Adjustment direction is required" });
  }
});

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
    deliveredQuantity: nonNegativeInt,
    unitCost: money.nullable().optional(),
  }).strict()).min(1),
}).strict();

export type SupplierInput = z.infer<typeof supplierSchema>;
export type InventoryMetadataInput = z.infer<typeof inventoryMetadataSchema>;
export type InventoryCreateInput = z.infer<typeof inventoryCreateSchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;
export type RestockCreateInput = z.infer<typeof restockCreateSchema>;
export type RestockStatusInput = z.infer<typeof restockStatusSchema>;
export type ReceiveRestockInput = z.infer<typeof receiveRestockSchema>;
