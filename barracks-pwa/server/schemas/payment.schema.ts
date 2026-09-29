import { z } from "zod";

export const paymentMethodSchema = z.enum(["cash", "card", "e_wallet", "bank_transfer", "other"]);
export const paymentStatusSchema = z.enum(["pending", "completed", "failed", "voided", "partially_refunded", "refunded", "unknown"]);

const visitSchema = z.union([
  z.object({ bookingId: z.number().int().positive() }).strict(),
  z.object({ queueEntryId: z.number().int().positive() }).strict(),
]);

const cashReceivedSchema = z.number().finite().nonnegative().max(9_999_999_999.99)
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(String(value)), "Use at most two decimal places");

export const createTransactionSchema = z.discriminatedUnion("paymentMethod", [
  z.object({ visit: visitSchema, paymentMethod: z.literal("cash"), amountReceived: cashReceivedSchema }).strict(),
  z.object({ visit: visitSchema, paymentMethod: z.enum(["card", "e_wallet", "bank_transfer", "other"]) }).strict(),
]);

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
