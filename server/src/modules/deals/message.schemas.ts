import { z } from "zod";

const id = z.string().uuid("Must be a UUID");

export const dealMessageParamsSchema = z
  .object({ dealId: id })
  .strict();

export const createMessageSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, "Enter a message")
      .max(2000, "Message is too long (max 2000 characters)"),
  })
  .strict();

export const listMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(256).optional(),
  })
  .strict();

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
