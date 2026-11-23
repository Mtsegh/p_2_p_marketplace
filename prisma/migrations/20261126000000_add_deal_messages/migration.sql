-- Messages between the two participants of a deal.
CREATE TABLE "deal_messages" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deal_messages_deal_id_created_at_idx" ON "deal_messages"("deal_id", "created_at");

ALTER TABLE "deal_messages" ADD CONSTRAINT "deal_messages_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_messages" ADD CONSTRAINT "deal_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
