import { z } from "zod";

export const walkInSchema = z.object({ customerId: z.number().int().positive(), serviceId: z.string().trim().min(1).max(80), barberId: z.number().int().positive().nullable().optional() }).strict();
export const queueChangeSchema = z.union([
  z.object({ barberId: z.number().int().positive().nullable() }).strict(),
  z.object({ status: z.enum(["waiting", "ready", "in_progress", "completed", "removed"]) }).strict(),
]);
