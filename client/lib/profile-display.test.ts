import { describe, expect, it } from "vitest";
import {
  FALLBACK_DISPLAY_NAME,
  displayNameOf,
  initialsForUser,
  initialsOf,
} from "./profile-display";

describe("displayNameOf", () => {
  it("uses the saved name when there is one", () => {
    expect(displayNameOf({ displayName: "Ade Balogun" })).toBe("Ade Balogun");
  });

  it("falls back without ever exposing the email address", () => {
    expect(displayNameOf({ displayName: "" })).toBe(FALLBACK_DISPLAY_NAME);
    expect(displayNameOf({ displayName: "   " })).toBe(FALLBACK_DISPLAY_NAME);
  });
});

describe("initialsOf", () => {
  it("takes the first and last initials", () => {
    expect(initialsOf("Ade Balogun")).toBe("AB");
    expect(initialsOf("Mary Jane Watson")).toBe("MW");
  });

  it("handles a single word", () => {
    expect(initialsOf("Ade")).toBe("A");
  });

  it("does not split a multi-byte character", () => {
    expect(initialsOf("😀 Tester")).toBe("😀T");
  });

  it("never returns an empty avatar", () => {
    expect(initialsOf("")).toBe("M");
    expect(initialsOf("   ")).toBe("M");
  });
});

describe("initialsForUser", () => {
  it("uses the display name when present", () => {
    expect(initialsForUser({ displayName: "Ade Balogun" })).toBe("AB");
  });

  it("uses one letter for an account without a name", () => {
    expect(initialsForUser({ displayName: "" })).toBe("M");
  });
});
