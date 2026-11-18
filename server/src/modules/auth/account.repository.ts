import { prisma } from "../../db/prisma.js";

/**
 * Writes used by account settings. Kept apart from `auth.repository` so the
 * session/token queries stay in one place and this file stays readable.
 */

/**
 * Changes the password and revokes the caller's other sessions in one
 * transaction, then returns the ids that need to join the access-token
 * denylist. The current session survives so the user is not signed out of the
 * device they are using.
 */
export function changePasswordAndRevokeOtherSessions(
  userId: string,
  currentSessionId: string,
  passwordHash: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    const sessions = await tx.session.findMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      select: { id: true },
    });

    if (sessions.length > 0) {
      await tx.session.updateMany({
        where: { id: { in: sessions.map((session) => session.id) } },
        data: { revokedAt: new Date() },
      });
    }

    return sessions.map((session) => session.id);
  });
}

/**
 * Swaps the address and marks it confirmed in one transaction. Confirming the
 * new address is what the emailed token proves, so verification travels with
 * the change instead of being reset.
 */
export function consumeEmailChangeToken(
  tokenId: string,
  userId: string,
  newEmail: string,
) {
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({
      where: {
        id: tokenId,
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (consumed.count === 0) {
      return null;
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: { email: newEmail, emailVerifiedAt: new Date() },
    });

    await tx.authToken.deleteMany({
      where: { userId, type: "EMAIL_CHANGE", usedAt: null },
    });

    return user;
  });
}

/**
 * Removes the personal data from an account while keeping the row itself. The
 * row stays because future listings, deals, and audit records reference it;
 * deleting it would either cascade away a counterparty's history or fail on a
 * foreign key. Email, credentials, profile text, sessions, and tokens all go.
 */
export function anonymizeAccount(userId: string, unusablePasswordHash: string) {
  return prisma.$transaction(async (tx) => {
    const sessions = await tx.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });

    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.authToken.deleteMany({ where: { userId } });

    await tx.profile.updateMany({
      where: { userId },
      data: { displayName: "", bio: "", location: "" },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        // Unique per account, reserved domain, and obviously not a real inbox.
        email: `deleted+${userId}@deleted.invalid`,
        passwordHash: unusablePasswordHash,
        status: "DELETED",
        emailVerifiedAt: null,
        phoneE164: null,
        phoneVerifiedAt: null,
      },
    });

    return sessions.map((session) => session.id);
  });
}

/** Everything a data export may contain. No hashes, no action tokens. */
export function findAccountExport(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      profile: {
        select: {
          displayName: true,
          bio: true,
          location: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userAgent: true,
          ip: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      },
    },
  });
}
