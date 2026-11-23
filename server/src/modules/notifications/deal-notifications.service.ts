import { Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { sendEmail } from "../email/email.queue.js";
import {
  dealEmail,
  type DealNotification,
} from "../email/templates/deal-notification.js";

export type DealEvent =
  | "proposal_received"
  | "proposal_accepted"
  | "proposal_rejected"
  | "funds_secured"
  | "handoff_completed"
  | "refund_issued"
  | "deal_cancelled";

const SUBJECTS: Record<DealEvent, string> = {
  proposal_received: "You received a new offer",
  proposal_accepted: "Your offer was accepted",
  proposal_rejected: "Your offer was not accepted",
  funds_secured: "Payment secured for your deal",
  handoff_completed: "Your deal is complete",
  refund_issued: "Your payment was refunded",
  deal_cancelled: "A deal was cancelled",
};

function dealUrl(dealId: string): string {
  return `${env.CLIENT_URL.replace(/\/$/, "")}/deals/${dealId}`;
}

function notificationFor(event: DealEvent, listingTitle: string): DealNotification {
  const common = { actionLabel: "View deal" };
  const footnote = "You are receiving this because of activity on a deal.";

  switch (event) {
    case "proposal_received":
      return {
        ...common,
        subject: SUBJECTS[event],
        heading: "New offer on your listing",
        paragraphs: [
          `Someone made an offer on "${listingTitle}".`,
          "Sign in to review and respond to it.",
        ],
        footnote,
      };
    case "proposal_accepted":
      return {
        ...common,
        subject: SUBJECTS[event],
        heading: "Your offer was accepted",
        paragraphs: [
          `The seller accepted your offer on "${listingTitle}".`,
          "Complete payment to secure the deal.",
        ],
        footnote,
      };
    case "proposal_rejected":
      return {
        ...common,
        subject: SUBJECTS[event],
        heading: "Your offer was not accepted",
        paragraphs: [
          `The seller declined your offer on "${listingTitle}".`,
          "You can browse other listings and make new offers.",
        ],
        footnote,
      };
    case "funds_secured":
      return {
        ...common,
        subject: SUBJECTS[event],
        heading: "Payment secured",
        paragraphs: [
          `Payment for "${listingTitle}" has been secured in escrow.`,
          "The seller can now arrange the handoff. Funds are released when the deal is completed.",
        ],
        footnote,
      };
    case "handoff_completed":
      return {
        ...common,
        subject: SUBJECTS[event],
        heading: "Deal complete",
        paragraphs: [
          `The handoff for "${listingTitle}" is confirmed.`,
          "The seller's payout has been released. Thank you for trading safely.",
        ],
        footnote,
      };
    case "refund_issued":
      return {
        ...common,
        subject: SUBJECTS[event],
        heading: "Payment refunded",
        paragraphs: [
          `The deal for "${listingTitle}" was not completed in time.`,
          "Your payment has been refunded in full.",
        ],
        footnote,
      };
    case "deal_cancelled":
      return {
        ...common,
        subject: SUBJECTS[event],
        heading: "Deal cancelled",
        paragraphs: [`The deal for "${listingTitle}" was cancelled.`],
        footnote,
      };
  }
}

/**
 * Sends a deal notification to one recipient at most once for a given event.
 * The unique event key makes repeated calls (replayed webhooks, retried
 * transitions) safe. Delivery failures are logged, never thrown, so a mail
 * outage cannot block a deal state change.
 */
export async function notifyDealEvent(input: {
  dealId: string;
  event: DealEvent;
  recipientId: string;
  listingTitle: string;
}): Promise<void> {
  const eventKey = `${input.dealId}:${input.event}:${input.recipientId}`;

  try {
    await prisma.notificationEvent.create({ data: { eventKey, recipientId: input.recipientId } });
  } catch (error) {
    // P2002 = already recorded; skip duplicate send.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: input.recipientId },
    select: { email: true },
  });

  if (!user) {
    throw AppError.notFound("Recipient not found");
  }

  const notification = notificationFor(input.event, input.listingTitle);
  const message = dealEmail(notification, dealUrl(input.dealId));

  await sendEmail({ ...message, to: user.email });
}
