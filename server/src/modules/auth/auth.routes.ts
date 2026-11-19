import { Router } from "express";
import { emailKey, ipKey, rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import * as controller from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

export const authRouter = Router();

const FIFTEEN_MINUTES = 15 * 60;
const ONE_HOUR = 60 * 60;

// Five signups per hour per IP: registration reports EMAIL_IN_USE, so it is
// also the endpoint that could be used to probe for accounts.
const registerLimit = rateLimit({
  name: "register-ip",
  limit: 5,
  windowSeconds: ONE_HOUR,
  key: ipKey,
});

// Two login buckets: one per address (stops guessing against one account) and
// one per IP (stops spraying many addresses from one host).
const loginIpLimit = rateLimit({
  name: "login-ip",
  limit: 30,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});
const loginEmailLimit = rateLimit({
  name: "login-email",
  limit: 10,
  windowSeconds: FIFTEEN_MINUTES,
  key: emailKey,
});

const refreshLimit = rateLimit({
  name: "refresh-ip",
  limit: 60,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

// Action tokens are 256-bit, so guessing is not the real risk; the limit keeps
// a script from hammering the endpoints and the database.
const verifyEmailLimit = rateLimit({
  name: "verify-email-ip",
  limit: 30,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

// Resends are per account: one impatient user must not exhaust the IP bucket
// for everyone behind the same address.
const resendVerificationLimit = rateLimit({
  name: "resend-verification-user",
  limit: 3,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

// Forgot-password is per address and per IP, and answers identically either
// way, so the buckets are what stop it from becoming an enumeration tool.
const forgotPasswordEmailLimit = rateLimit({
  name: "forgot-password-email",
  limit: 5,
  windowSeconds: ONE_HOUR,
  key: emailKey,
});
const forgotPasswordIpLimit = rateLimit({
  name: "forgot-password-ip",
  limit: 10,
  windowSeconds: ONE_HOUR,
  key: ipKey,
});

const resetPasswordLimit = rateLimit({
  name: "reset-password-ip",
  limit: 10,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

// Authenticated and password-gated, so a per-user bucket is enough.
const changePasswordLimit = rateLimit({
  name: "password-change-user",
  limit: 5,
  windowSeconds: FIFTEEN_MINUTES,
  key: userKey,
});

const changeEmailLimit = rateLimit({
  name: "email-change-user",
  limit: 3,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

const confirmEmailChangeLimit = rateLimit({
  name: "email-change-confirm-ip",
  limit: 30,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

const deleteAccountLimit = rateLimit({
  name: "delete-account-user",
  limit: 3,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

const exportAccountLimit = rateLimit({
  name: "export-account-user",
  limit: 5,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

const sendPhoneOtpLimit = rateLimit({
  name: "phone-send-user",
  limit: 3,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

const verifyPhoneOtpLimit = rateLimit({
  name: "phone-verify-user",
  limit: 10,
  windowSeconds: FIFTEEN_MINUTES,
  key: userKey,
});

authRouter.post(
  "/register",
  requireTrustedOrigin,
  registerLimit,
  controller.register,
);
authRouter.post(
  "/login",
  requireTrustedOrigin,
  loginIpLimit,
  loginEmailLimit,
  controller.login,
);
authRouter.post(
  "/refresh",
  requireTrustedOrigin,
  refreshLimit,
  controller.refresh,
);
authRouter.post("/logout", requireTrustedOrigin, controller.logout);

authRouter.get("/me", requireAuth, controller.me);
authRouter.get("/sessions", requireAuth, controller.sessions);
authRouter.delete(
  "/sessions/:sessionId",
  requireAuth,
  controller.revokeSession,
);

authRouter.post(
  "/verify-email",
  requireTrustedOrigin,
  verifyEmailLimit,
  controller.verifyEmail,
);
authRouter.post(
  "/verify-email/resend",
  requireTrustedOrigin,
  requireAuth,
  resendVerificationLimit,
  controller.resendVerification,
);

authRouter.post(
  "/password/forgot",
  requireTrustedOrigin,
  forgotPasswordIpLimit,
  forgotPasswordEmailLimit,
  controller.forgotPassword,
);
authRouter.post(
  "/password/reset",
  requireTrustedOrigin,
  resetPasswordLimit,
  controller.resetPassword,
);

authRouter.post(
  "/password/change",
  requireTrustedOrigin,
  requireAuth,
  changePasswordLimit,
  controller.changePassword,
);

authRouter.post(
  "/email/change",
  requireTrustedOrigin,
  requireAuth,
  changeEmailLimit,
  controller.changeEmail,
);
authRouter.post(
  "/email/change/confirm",
  requireTrustedOrigin,
  confirmEmailChangeLimit,
  controller.confirmEmailChange,
);

authRouter.get(
  "/account/export",
  requireAuth,
  exportAccountLimit,
  controller.exportAccount,
);
authRouter.delete(
  "/account",
  requireTrustedOrigin,
  requireAuth,
  deleteAccountLimit,
  controller.deleteAccount,
);

authRouter.post(
  "/phone/send",
  requireTrustedOrigin,
  requireAuth,
  sendPhoneOtpLimit,
  controller.sendPhoneOtp,
);
authRouter.post(
  "/phone/verify",
  requireTrustedOrigin,
  requireAuth,
  verifyPhoneOtpLimit,
  controller.verifyPhoneOtp,
);
authRouter.post(
  "/phone/resend",
  requireTrustedOrigin,
  requireAuth,
  sendPhoneOtpLimit,
  controller.resendPhoneOtp,
);
