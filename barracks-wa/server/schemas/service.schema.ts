import { z } from "zod";

export const serviceIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
export const serviceSchema = z.object({
  id: serviceIdSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500),
  price: z.number().finite().min(0).max(9999999999.99).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "Use up to 2 decimal places"),
  durationMinutes: z.number().int().positive().max(2147483647),
  active: z.boolean(),
}).strict();
export const serviceUpdateSchema = serviceSchema.omit({ id: true }).partial().strict();
export type ServiceInput = z.infer<typeof serviceSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
