CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "event_key" VARCHAR(200) NOT NULL,
    "recipient_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_events_event_key_key" ON "notification_events"("event_key");
