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

/**
 * Emailed action token. base64url of 32 bytes is 43 characters; the range is
 * generous so a future format change does not need a schema change, while still
 * rejecting empty or absurdly long input before it reaches the database.
 */
const actionToken = z
  .string()
  .trim()
  .min(26, "Token is invalid")
  .max(128, "Token is invalid");

export const verifyEmailSchema = z.object({ token: actionToken }).strict();

export const forgotPasswordSchema = z.object({ email }).strict();

export const resetPasswordSchema = z
  .object({ token: actionToken, password })
  .strict();

/**
 * The current password is only checked for presence, not for the 10-character
 * policy: an account created before that rule still has a valid short password.
 */
const currentPassword = z
  .string()
  .min(1, "Enter your password")
  .max(200, "Password is too long");

export const changePasswordSchema = z
  .object({ currentPassword, newPassword: password })
  .strict();

export const changeEmailSchema = z
  .object({ newEmail: email, password: currentPassword })
  .strict();

export const deleteAccountSchema = z
  .object({ password: currentPassword })
  .strict();

export const emailChangeConfirmSchema = z
  .object({ token: actionToken })
  .strict();

export const sessionParamsSchema = z
  .object({ sessionId: z.string().uuid("Session id must be a UUID") })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
