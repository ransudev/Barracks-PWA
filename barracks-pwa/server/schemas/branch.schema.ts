import { z } from "zod";

export const branchIdSchema = z.coerce.number().int().positive().max(2147483647);
export const branchSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().toUpperCase().min(1).max(40).regex(/^[A-Z0-9][A-Z0-9_-]*$/),
  address: z.string().trim().max(500).default(""),
  phone: z.string().trim().max(40).default(""),
  status: z.enum(["active", "inactive"]).default("active"),
}).strict();
export const branchUpdateSchema = branchSchema.partial().refine((input) => Object.keys(input).length > 0, "Provide a branch field");
export const branchAssignmentSchema = z.object({ userId: z.number().int().positive().max(2147483647), isPrimary: z.boolean().default(false) }).strict();
export const branchPrimarySchema = z.object({ isPrimary: z.literal(true) }).strict();
export type BranchInput = z.infer<typeof branchSchema>;
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>;
