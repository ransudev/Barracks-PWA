import { z } from "zod";
import { userRoles } from "@/app/constants/roles";

export const userRoleSchema = z.enum(userRoles);
export const staffRoleSchema = z.enum(["administrator", "front_desk"]);

export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    role: userRoleSchema,
  })
  .strict();

export const createStaffUserSchema = createUserSchema.extend({
  role: staffRoleSchema,
});

export const updateStaffUserSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
    password: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
    role: staffRoleSchema,
  })
  .strict();

export const userLifecycleSchema = z
  .object({
    action: z.enum(["verify", "unverify", "block", "unblock"]),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
    password: z.string().min(1, "Password is required").max(128),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateStaffUserInput = z.infer<typeof updateStaffUserSchema>;
export type UserLifecycleInput = z.infer<typeof userLifecycleSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
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
