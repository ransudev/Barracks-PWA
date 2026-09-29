import { z } from "zod";

export const paymentMethodSchema = z.enum(["cash", "card", "e_wallet", "bank_transfer", "other"]);
export const paymentStatusSchema = z.enum(["pending", "completed", "failed", "voided", "partially_refunded", "refunded", "unknown"]);

export const createTransactionSchema = z.object({
  visit: z.union([
    z.object({ bookingId: z.number().int().positive() }).strict(),
    z.object({ queueEntryId: z.number().int().positive() }).strict(),
  ]),
  paymentMethod: paymentMethodSchema,
}).strict();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
