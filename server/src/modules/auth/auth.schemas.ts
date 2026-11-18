import { z } from "zod";

/**
 * The client duplicates these rules for inline validation. Keep the shapes in
 * sync when either side changes; there is no shared package by design.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .email("Enter a valid email address");

const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Password is too long");

export const registerSchema = z.object({ email, password }).strict();

export const loginSchema = z.object({ email, password }).strict();

export const sessionParamsSchema = z
  .object({ sessionId: z.string().uuid("Session id must be a UUID") })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
