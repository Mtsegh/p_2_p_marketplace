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
  setCookies,
} from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

async function signInUser() {
  const user = await registerUser(app);
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: user.password })
    .expect(200);

  return {
    ...user,
    accessToken: response.body.data.accessToken as string,
    cookie: setCookies(response).find((c) => c.startsWith("marketplace_refresh="))!,
  };
}

describe("POST /api/v1/auth/phone/send", () => {
  it("sends a 6-digit code to the phone number", async () => {
    const user = await signInUser();

    const response = await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone: `+1415555${Math.floor(1000 + Math.random() * 9000)}` })
      .expect(202);

    expect(response.body.data).toMatchObject({ status: "queued" });

    const sms = lastSmsTo(
      `+1415555${Math.floor(1000 + Math.random() * 9000)}`,
    );
    expect(sms).toBeDefined();
    expect(/\b\d{6}\b/.test(sms!.body)).toBe(true);
  });

  it("rejects an invalid phone number", async () => {
    const user = await signInUser();

    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone: "not-a-phone" })
      .expect(422);
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

    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "https://evil.example")
      .send({ phone: "+14155552671" })
      .expect(403);
  });

  it("rate limits sends per user", async () => {
    const user = await signInUser();
    const phone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app)
        .post("/api/v1/auth/phone/send")
        .set("Cookie", user.cookie!)
        .set("Origin", "http://localhost:3000")
        .send({ phone })
        .expect(202);
    }

    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone })
      .expect(429);
  });
});

describe("POST /api/v1/auth/phone/verify", () => {
  it("verifies the code and marks the phone as verified", async () => {
    const user = await signInUser();
    const phone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;

    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone })
      .expect(202);

    const sms = lastSmsTo(phone);
    const code = codeFromSms(sms!);

    await request(app)
      .post("/api/v1/auth/phone/verify")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone, code })
      .expect(204);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

    expect(dbUser!.phoneE164).toBe(phone);
    expect(dbUser!.phoneVerifiedAt).not.toBeNull();
  });

  it("rejects a wrong code", async () => {
    const user = await signInUser();
    const phone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;

    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone })
      .expect(202);

    await request(app)
      .post("/api/v1/auth/phone/verify")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone, code: "000000" })
      .expect(400);
  });

  it("rejects a code for the wrong phone number", async () => {
    const user = await signInUser();
    const phone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;
    const otherPhone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;

    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone })
      .expect(202);

    const sms = lastSmsTo(phone);
    const code = codeFromSms(sms!);

    await request(app)
      .post("/api/v1/auth/phone/verify")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone: otherPhone, code })
      .expect(400);
  });

  it("rejects verification without a pending token", async () => {
    const user = await signInUser();

    await request(app)
      .post("/api/v1/auth/phone/verify")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone: "+14155552671", code: "123456" })
      .expect(400);
  });

  it("is single-use: verifying twice fails the second time", async () => {
    const user = await signInUser();
    const phone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;

    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone })
      .expect(202);

    const sms = lastSmsTo(phone);
    const code = codeFromSms(sms!);

    await request(app)
      .post("/api/v1/auth/phone/verify")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone, code })
      .expect(204);

    await request(app)
      .post("/api/v1/auth/phone/verify")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone, code })
      .expect(400);
  });
});

describe("POST /api/v1/auth/phone/resend", () => {
  it("sends a new code to the same phone number", async () => {
    const user = await signInUser();
    const phone = `+1415555${Math.floor(1000 + Math.random() * 9000)}`;

    await request(app)
      .post("/api/v1/auth/phone/send")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone })
      .expect(202);

    await request(app)
      .post("/api/v1/auth/phone/resend")
      .set("Cookie", user.cookie!)
      .set("Origin", "http://localhost:3000")
      .send({ phone })
      .expect(202);

    const all = readSmsOutbox();
    const phoneMessages = all.filter((m: { to: string }) => m.to === phone);

    expect(phoneMessages.length).toBeGreaterThanOrEqual(2);
  });
});
