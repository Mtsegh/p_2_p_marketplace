import { AppError } from "../../lib/app-error.js";
import * as repository from "./message.repository.js";
import type { CreateMessageInput, ListMessagesQuery } from "./message.schemas.js";

/** Verifies the user is one of the deal's two participants. */
async function assertParticipant(dealId: string, userId: string) {
  const participants = await repository.findDealParticipants(dealId);

  if (!participants) {
    throw AppError.notFound("Deal not found");
  }

  if (participants.buyerId !== userId && participants.sellerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "You are not part of this deal");
  }
}

export async function postMessage(
  dealId: string,
  userId: string,
  input: CreateMessageInput,
) {
  await assertParticipant(dealId, userId);

  return repository.createMessage({
    dealId,
    senderId: userId,
    body: input.body,
  });
}

export async function listMessages(
  dealId: string,
  userId: string,
  query: ListMessagesQuery,
) {
  await assertParticipant(dealId, userId);

  const result = await repository.listMessages(dealId, query);

  return {
    messages: result.messages.map((message) => ({
      id: message.id,
      dealId: message.dealId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
    nextCursor: result.nextCursor,
  };
}
