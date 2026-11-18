import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/error-handler.js";
import {
  requireAuth,
  requireVerifiedEmail,
} from "../src/modules/auth/auth.middleware.js";
import { passwordResetEmail } from "../src/modules/email/templates/password-reset.js";
import { verificationEmail } from "../src/modules/email/templates/verification.js";
import { createApp } from "../src/app.js";
import {
  lastEmailTo,
  registerUser,
  resetIdentityState,
  tokenFromEmail,
} from "./helpers.js";

describe("email templates", () => {
  const url = "https://app.example.com/verify-email?token=abc123";

  it("renders a verification email with a plain-text link", () => {
    const email = verificationEmail({ url, expiresInHours: 24 });

    expect(email.subject).toBe("Confirm your email address");
    expect(email.text).toContain(url);
    expect(email.text).toContain("24 hours");
    expect(email.html).toContain(url.replace(/&/g, "&amp;"));
    expect(email.html).toContain("Confirm email address");
    expect(email.html).not.toMatch(/<link|@import|https:\/\/fonts\./);
  });

  it("renders a reset email with the shorter expiry", () => {
    const email = passwordResetEmail({
      url: "https://app.example.com/reset-password?token=abc123",
      expiresInMinutes: 60,
    });

    expect(email.subject).toBe("Reset your password");
    expect(email.text).toContain("60 minutes");
    expect(email.text).toContain("/reset-password?token=abc123");
    expect(email.html).toContain("/reset-password?token=abc123");
  });
});

describe("brevo provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("posts the message to the Brevo API", async () => {
    vi.resetModules();
    vi.stubEnv("BREVO_API_KEY", "brevo-test-key");
    vi.stubEnv("EMAIL_FROM_ADDRESS", "no-reply@marketplace.test");
    vi.stubEnv("EMAIL_FROM_NAME", "P2P Marketplace");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "<abc@brevo>" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { brevoProvider } =
      await import("../src/modules/email/brevo.provider.js");

    await brevoProvider.send({
      to: "person@example.com",
      subject: "Confirm your email address",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe(
      "brevo-test-key",
    );
    expect(body).toMatchObject({
      sender: { email: "no-reply@marketplace.test", name: "P2P Marketplace" },
      to: [{ email: "person@example.com" }],
      subject: "Confirm your email address",
      htmlContent: "<p>Hello</p>",
      textContent: "Hello",
    });
  });

  it("fails without leaking the key when Brevo rejects the message", async () => {
    vi.resetModules();
    vi.stubEnv("BREVO_API_KEY", "brevo-secret-key");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "invalid_parameter",
              message: "bad sender",
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          ),
        ),
    );

    const { brevoProvider } =
      await import("../src/modules/email/brevo.provider.js");

    await expect(
      brevoProvider.send({
        to: "person@example.com",
        subject: "Subject",
        html: "<p>Hello</p>",
        text: "Hello",
      }),
    ).rejects.toThrow(/Brevo responded 400/);
  });
});

describe("requireVerifiedEmail", () => {
  const app = createApp();

  function probe() {
    const subject = express();
    subject.use(express.json());
    subject.use((req, _res, next) => {
      req.id = "test-request-id";
      next();
    });
    subject.get("/probe", requireAuth, requireVerifiedEmail, (_req, res) => {
      res.json({ data: { ok: true } });
    });
    subject.use(errorHandler);

    return subject;
  }

  beforeEach(async () => {
    await resetIdentityState();
  });

  it("forbids an unconfirmed account", async () => {
    const user = await registerUser(app);

    const response = await request(probe())
      .get("/probe")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);

    expect(response.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("allows a confirmed account through", async () => {
    const user = await registerUser(app);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token })
      .expect(200);

    await request(probe())
      .get("/probe")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
  });
});
