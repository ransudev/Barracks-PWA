import { z } from "zod";

export const userRoles = ["administrator", "barber", "front_desk"] as const;

export const userRoleSchema = z.enum(userRoles);

export const createUserSchema = z
  .object({
    username: z.string().trim().min(1, "Username is required").max(100),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    role: userRoleSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    username: z.string().trim().min(1, "Username is required").max(100),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const updateUserSchema = z
  .object({
    username: z.string().trim().min(1, "Username is required").max(100).optional(),
    role: userRoleSchema.optional(),
    active: z.boolean().optional(),
    password: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;

export type ValidationErrors = Record<string, string[]>;

export function formatValidationErrors(error: z.ZodError): ValidationErrors {
  return error.issues.reduce<ValidationErrors>((errors, issue) => {
    const field = issue.path[0]?.toString() ?? "form";
    errors[field] ??= [];
    errors[field].push(issue.message);
    return errors;
  }, {});
}
