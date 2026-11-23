import { prisma } from "../../db/prisma.js";
import type { ListMessagesQuery } from "./message.schemas.js";

const MESSAGE_SELECT = {
  id: true,
  dealId: true,
  senderId: true,
  body: true,
  createdAt: true,
} as const;

/** Finds a deal's participants so the service can check access. */
export function findDealParticipants(dealId: string) {
  return prisma.deal.findUnique({
    where: { id: dealId },
    select: { buyerId: true, sellerId: true },
  });
}

/** Creates a message authored by a participant. */
export function createMessage(input: {
  dealId: string;
  senderId: string;
  body: string;
}) {
  return prisma.dealMessage.create({
    data: input,
    select: MESSAGE_SELECT,
  });
}

/**
 * Lists a deal's messages oldest-first for chat display. The cursor is the id
 * of the last message; we fetch limit+1 and use it to compute the next page.
 */
export async function listMessages(dealId: string, query: ListMessagesQuery) {
  const rows = await prisma.dealMessage.findMany({
    where: { dealId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(query.cursor
      ? {
          cursor: { id: query.cursor },
          skip: 1,
        }
      : {}),
    select: MESSAGE_SELECT,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    messages: page,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}
