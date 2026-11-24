import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { createAdmin, registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function auth(token: string) {
  return (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
}

async function setup() {
  const reporter = await registerUser(app);
  const target = await registerUser(app);
  const admin = await createAdmin(app);

  const listing = await prisma.listing.create({
    data: {
      ownerId: target.id,
      title: "Reported listing",
      description: "x",
      location: "Lagos",
      status: "ACTIVE",
    },
  });

  return { reporter, target, admin, listing };
}

function fileReport(
  token: string,
  targetType: "listing" | "user",
  targetId: string,
  reason = "This looks like a scam listing",
) {
  return auth(token)(
    request(app)
      .post("/api/v1/reports")
      .set("Origin", "http://localhost:3000")
      .send({ targetType, targetId, reason }),
  );
}

describe("reports", () => {
  it("files a report on a listing", async () => {
    const { reporter, listing } = await setup();

    const response = await fileReport(
      reporter.accessToken,
      "listing",
      listing.id,
    ).expect(201);

    expect(response.body.data.report).toMatchObject({
      targetType: "listing",
      targetId: listing.id,
      status: "OPEN",
    });
  });

  it("files a report on a user", async () => {
    const { reporter, target } = await setup();

    await fileReport(reporter.accessToken, "user", target.id, "Bad behaviour").expect(201);
  });

  it("rejects reporting yourself or your own listing", async () => {
    const { reporter } = await setup();

    await fileReport(reporter.accessToken, "user", reporter.id).expect(422);
    const own = await prisma.listing.create({
      data: {
        ownerId: reporter.id,
        title: "Own",
        description: "x",
        location: "Lagos",
        status: "ACTIVE",
      },
    });
    await fileReport(reporter.accessToken, "listing", own.id).expect(422);
  });

  it("rejects a duplicate open report", async () => {
    const { reporter, listing } = await setup();

    await fileReport(reporter.accessToken, "listing", listing.id).expect(201);
    await fileReport(reporter.accessToken, "listing", listing.id).expect(409);
  });

  it("rejects a report on a missing target", async () => {
    const { reporter } = await setup();

    await fileReport(
      reporter.accessToken,
      "listing",
      "00000000-0000-4000-8000-000000000000",
    ).expect(404);
  });

  it("only admins can see the queue and resolve", async () => {
    const { reporter, listing } = await setup();

    await fileReport(reporter.accessToken, "listing", listing.id).expect(201);

    await request(app).get("/api/v1/reports").expect(401);
    await auth(reporter.accessToken)(request(app).get("/api/v1/reports")).expect(403);
  });

  it("resolves a report by actioning and removing the listing", async () => {
    const { reporter, admin, listing } = await setup();

    const created = await fileReport(reporter.accessToken, "listing", listing.id).expect(201);
    const reportId = created.body.data.report.id;

    const resolved = await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/reports/${reportId}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send({ action: "actioned", note: "Confirmed scam", suspendUser: true }),
    ).expect(200);

    expect(resolved.body.data.report.status).toBe("ACTIONED");

    const updatedListing = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(updatedListing?.status).toBe("REMOVED");
  });

  it("resolves a user report by suspending the user", async () => {
    const { reporter, admin, target } = await setup();

    const created = await fileReport(reporter.accessToken, "user", target.id).expect(201);

    await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/reports/${created.body.data.report.id}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send({ action: "actioned", suspendUser: true }),
    ).expect(200);

    const updated = await prisma.user.findUnique({ where: { id: target.id } });
    expect(updated?.status).toBe("SUSPENDED");
  });

  it("dismisses a report with no action", async () => {
    const { reporter, admin, listing } = await setup();

    const created = await fileReport(reporter.accessToken, "listing", listing.id).expect(201);

    const resolved = await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/reports/${created.body.data.report.id}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send({ action: "dismissed", note: "No violation" }),
    ).expect(200);
    expect(resolved.body.data.report.status).toBe("DISMISSED");

    const updatedListing = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(updatedListing?.status).toBe("ACTIVE");
  });

  it("rejects resolving the same report twice", async () => {
    const { reporter, admin, listing } = await setup();

    const created = await fileReport(reporter.accessToken, "listing", listing.id).expect(201);
    const body = { action: "dismissed" };

    await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/reports/${created.body.data.report.id}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send(body),
    ).expect(200);

    await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/reports/${created.body.data.report.id}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send(body),
    ).expect(409);
  });
});
