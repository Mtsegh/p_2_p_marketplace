import type { Request, RequestHandler } from "express";
import { AppError } from "../../lib/app-error.js";
import { parseInput } from "../../lib/validate.js";
import * as authService from "./auth.service.js";
import { toUserDto } from "./auth.dto.js";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "./cookies.js";
import * as emailVerification from "./email-verification.service.js";
import * as passwordReset from "./password-reset.service.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sessionParamsSchema,
  verifyEmailSchema,
} from "./auth.schemas.js";

function requestContext(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
  };
}

function authData(result: authService.AuthResult) {
  return {
    user: toUserDto(result.user),
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  };
}

export const register: RequestHandler = async (req, res) => {
  const input = parseInput(registerSchema, req.body);
  const result = await authService.register(input, requestContext(req));

  setRefreshCookie(res, result.refreshToken);
  res
    .status(201)
    .location("/api/v1/auth/me")
    .json({ data: authData(result), meta: { requestId: req.id } });
};

export const login: RequestHandler = async (req, res) => {
  const input = parseInput(loginSchema, req.body);
  const result = await authService.login(input, requestContext(req));

  setRefreshCookie(res, result.refreshToken);
  res.json({ data: authData(result), meta: { requestId: req.id } });
};

export const refresh: RequestHandler = async (req, res) => {
  const token = readRefreshCookie(req);

  if (!token) {
    throw AppError.unauthorized("No active session");
  }

  const result = await authService.refresh(token, requestContext(req));

  setRefreshCookie(res, result.refreshToken);
  res.json({ data: authData(result), meta: { requestId: req.id } });
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(readRefreshCookie(req));

  clearRefreshCookie(res);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  const user = await authService.getAuthenticatedUser(req.auth!.userId);

  res.json({ data: { user: toUserDto(user) }, meta: { requestId: req.id } });
};

export const sessions: RequestHandler = async (req, res) => {
  const list = await authService.listSessions(
    req.auth!.userId,
    req.auth!.sessionId,
  );

  res.json({ data: { sessions: list }, meta: { requestId: req.id } });
};

export const revokeSession: RequestHandler = async (req, res) => {
  const { sessionId } = parseInput(sessionParamsSchema, req.params);
  const result = await authService.revokeOwnedSession(
    req.auth!.userId,
    sessionId,
    req.auth!.sessionId,
  );

  if (result.revokedCurrent) {
    clearRefreshCookie(res);
  }

  res.status(204).end();
};

export const verifyEmail: RequestHandler = async (req, res) => {
  const { token } = parseInput(verifyEmailSchema, req.body);
  const user = await emailVerification.verifyEmail(token);

  res.json({ data: { user: toUserDto(user) }, meta: { requestId: req.id } });
};

export const resendVerification: RequestHandler = async (req, res) => {
  await emailVerification.resendVerificationEmail(req.auth!.userId);

  res
    .status(202)
    .json({ data: { status: "queued" }, meta: { requestId: req.id } });
};

export const forgotPassword: RequestHandler = async (req, res) => {
  const { email } = parseInput(forgotPasswordSchema, req.body);

  await passwordReset.requestPasswordReset(email);

  // Always the same answer: whether the address has an account is not revealed.
  res
    .status(202)
    .json({ data: { status: "accepted" }, meta: { requestId: req.id } });
};

export const resetPassword: RequestHandler = async (req, res) => {
  const { token, password } = parseInput(resetPasswordSchema, req.body);

  await passwordReset.resetPassword(token, password);

  // Every session was revoked by the reset, so the cookie (if any) is dead too.
  clearRefreshCookie(res);
  res.status(204).end();
};
