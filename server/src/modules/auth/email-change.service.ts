import { env } from "../../config/env.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/app-error.js";
import { sendEmail } from "../email/email.queue.js";
import { emailChangeEmail } from "../email/templates/email-change.js";
import {
  EMAIL_CHANGE_TTL_MS,
  createActionToken,
  hashActionToken,
  invalidActionLink,
} from "./action-tokens.js";
import * as accountRepository from "./account.repository.js";
import * as repository from "./auth.repository.js";
import { verifyPassword } from "./password.js";

const TTL_MINUTES = EMAIL_CHANGE_TTL_MS / 60_000;

export function emailChangeUrl(token: string): string {
  const base = env.CLIENT_URL.replace(/\/+$/, "");

  return `${base}/email-change/confirm?token=${encodeURIComponent(token)}`;
}

/**
 * Starts an email change. The link goes to the new address, not the old one:
 * receiving it is the proof that the user controls the inbox they want to use.
 * The current password is required so a hijacked session cannot move the
 * account to an attacker's address.
 */
export async function requestEmailChange(
  userId: string,
  input: { newEmail: string; password: string },
): Promise<void> {
  const user = await repository.findUserById(userId);

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Your account is not active");
  }

  const matches = await verifyPassword(user.passwordHash, input.password);

  if (!matches) {
    throw new AppError("INVALID_PASSWORD", 400, "The password is incorrect");
  }

  if (input.newEmail === user.email) {
    throw new AppError(
      "EMAIL_UNCHANGED",
      409,
      "That is already the email address on this account",
    );
  }

  const existing = await repository.findUserByEmail(input.newEmail);

  if (existing) {
    throw new AppError(
      "EMAIL_IN_USE",
      409,
      "An account with this email already exists",
    );
  }

  const { token, tokenHash } = createActionToken();

  await repository.createAuthToken({
    userId,
    type: "EMAIL_CHANGE",
    tokenHash,
    expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
    payload: { newEmail: input.newEmail },
  });

  const message = emailChangeEmail({
    url: emailChangeUrl(token),
    newEmail: input.newEmail,
    expiresInMinutes: TTL_MINUTES,
  });

  // Not swallowed: if the mail cannot be queued, the user must be told instead
  // of being sent to an inbox that will never receive anything.
  await sendEmail({ to: input.newEmail, ...message });
}

/**
 * Completes the change from the emailed link. No session is required: the
 * token is the credential, and a user may well open the mail on their phone.
 * The new address is re-checked at this point because another account may have
 * taken it since the request.
 */
export async function confirmEmailChange(
  token: string,
): Promise<{ email: string; userId: string }> {
  const record = await repository.findAuthToken(
    hashActionToken(token),
    "EMAIL_CHANGE",
  );

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw invalidActionLink();
  }

  const payload = record.payload as { newEmail?: unknown } | null;
  const newEmail =
    typeof payload?.newEmail === "string" ? payload.newEmail : null;

  if (!newEmail) {
    throw invalidActionLink();
  }

  try {
    const user = await accountRepository.consumeEmailChangeToken(
      record.id,
      record.userId,
      newEmail,
    );

    if (!user) {
      throw invalidActionLink();
    }

    return { email: user.email, userId: user.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "EMAIL_IN_USE",
        409,
        "An account with this email already exists",
      );
    }

    throw error;
  }
}
