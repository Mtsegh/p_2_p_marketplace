import type { DealStatus } from "../../generated/prisma/enums.js";
import { AppError } from "../../lib/app-error.js";

/**
 * The explicit deal state machine. Only transitions listed here are legal;
 * everything else is rejected. Later chunks extend this map (and the DealStatus
 * enum already lists the future states) when payments and disputes land.
 *
 * proposed -> accepted -> payment pending -> completed
 * proposed -> rejected
 * proposed -> cancelled (by the proposer)
 * accepted -> cancelled
 * accepted -> disputed -> resolved (admin)
 */
export const ALLOWED_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  PROPOSED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["CANCELLED", "PAYMENT_PENDING"],
  REJECTED: [],
  CANCELLED: [],
  PAYMENT_PENDING: ["COMPLETED", "CANCELLED", "DISPUTED"],
  COMPLETED: [],
  DISPUTED: ["RESOLVED"],
  RESOLVED: [],
};

/** Throws the standard error when a transition is not permitted. */
export function assertTransition(from: DealStatus, to: DealStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      "INVALID_TRANSITION",
      409,
      `Cannot move a deal from ${from} to ${to}`,
    );
  }
}

/** Who may perform a transition. Returns null for system-only transitions. */
export function actorFor(to: DealStatus): "buyer" | "seller" | null {
  switch (to) {
    case "CANCELLED":
      return "buyer"; // seller cancel is added with payment/release rules
    case "REJECTED":
      return "seller";
    case "ACCEPTED":
      return "seller";
    default:
      return null;
  }
}
