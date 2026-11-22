import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import {
  codeFromSms,
  lastSmsTo,
  readSmsOutbox,
  registerUser,
  resetIdentityState,
} from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

async function signInUser() {
  return registerUser(app);
}

function randomPhone(): string {
  return `+1415555${Math.floor(1000 + Math.random() * 9000)}`;
}

function auth(token: string) {
  return (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
}

describe("POST /api/v1/auth/phone/send", () => {
  it("sends a 6-digit code to the phone number", async () => {
    const user = await signInUser();
    const phone = randomPhone();

    const response = await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "http://localhost:3000")
        .send({ phone }),
    ).expect(202);

    expect(response.body.data).toMatchObject({ status: "queued" });

    const sms = lastSmsTo(phone);
    expect(sms).toBeDefined();
    expect(/\b\d{6}\b/.test(sms!.body)).toBe(true);
  });

  it("rejects an invalid phone number", async () => {
    const user = await signInUser();

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "http://localhost:3000")
        .send({ phone: "not-a-phone" }),
    ).expect(422);
  });

  it("requires authentication", async () => {
    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Origin", "http://localhost:3000")
      .send({ phone: "+14155552671" })
      .expect(401);
  });

  it("rejects writes from another origin", async () => {
    const user = await signInUser();

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "https://evil.example")
        .send({ phone: "+14155552671" }),
    ).expect(403);
  });

  it("rate limits sends per user", async () => {
    const user = await signInUser();
    const phone = randomPhone();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await auth(user.accessToken)(
        request(app)
          .post("/api/v1/auth/phone/send")
          .set("Origin", "http://localhost:3000")
          .send({ phone }),
      ).expect(202);
    }

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "http://localhost:3000")
        .send({ phone }),
    ).expect(429);
  });
});

describe("POST /api/v1/auth/phone/verify", () => {
  it("verifies the code and marks the phone as verified", async () => {
    const user = await signInUser();
    const phone = randomPhone();

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "http://localhost:3000")
        .send({ phone }),
    ).expect(202);

    const sms = lastSmsTo(phone);
    const code = codeFromSms(sms!);

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/verify")
        .set("Origin", "http://localhost:3000")
        .send({ phone, code }),
    ).expect(204);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

    expect(dbUser!.phoneE164).toBe(phone);
    expect(dbUser!.phoneVerifiedAt).not.toBeNull();
  });

  it("rejects a wrong code", async () => {
    const user = await signInUser();
    const phone = randomPhone();

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "http://localhost:3000")
        .send({ phone }),
    ).expect(202);

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/verify")
        .set("Origin", "http://localhost:3000")
        .send({ phone, code: "000000" }),
    ).expect(400);
  });

  it("rejects a code for the wrong phone number", async () => {
    const user = await signInUser();
    const phone = randomPhone();
    const otherPhone = randomPhone();

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "http://localhost:3000")
        .send({ phone }),
    ).expect(202);

    const sms = lastSmsTo(phone);
    const code = codeFromSms(sms!);

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/verify")
        .set("Origin", "http://localhost:3000")
        .send({ phone: otherPhone, code }),
    ).expect(400);
  });

  it("rejects verification without a pending token", async () => {
    const user = await signInUser();

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/verify")
        .set("Origin", "http://localhost:3000")
        .send({ phone: "+14155552671", code: "123456" }),
    ).expect(400);
  });

  it("is single-use: verifying twice fails the second time", async () => {
    const user = await signInUser();
    const phone = randomPhone();

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "http://localhost:3000")
        .send({ phone }),
    ).expect(202);

    const sms = lastSmsTo(phone);
    const code = codeFromSms(sms!);

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/verify")
        .set("Origin", "http://localhost:3000")
        .send({ phone, code }),
    ).expect(204);

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/verify")
        .set("Origin", "http://localhost:3000")
        .send({ phone, code }),
    ).expect(400);
  });
});

describe("POST /api/v1/auth/phone/resend", () => {
  it("sends a new code to the same phone number", async () => {
    const user = await signInUser();
    const phone = randomPhone();

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/send")
        .set("Origin", "http://localhost:3000")
        .send({ phone }),
    ).expect(202);

    await auth(user.accessToken)(
      request(app)
        .post("/api/v1/auth/phone/resend")
        .set("Origin", "http://localhost:3000")
        .send({ phone }),
    ).expect(202);

    const phoneMessages = readSmsOutbox().filter((m) => m.to === phone);
    expect(phoneMessages.length).toBeGreaterThanOrEqual(2);
  });
});
