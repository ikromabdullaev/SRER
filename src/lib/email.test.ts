import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { emailEnabled, editorialAddress, notifyEditors } from "./email";

const saved = { ...process.env };

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.EDITORIAL_EMAIL = "editors@example.org";
  delete process.env.RESEND_FROM;
});

afterEach(() => {
  process.env = { ...saved };
});

const proposal = {
  name: "Dilnoza R.",
  email: "d@example.uz",
  affiliation: null,
  title: "Labour migration",
  abstract: "An abstract.",
  locale: "uz",
  coauthorNote: null,
  hasAttachment: false,
};

describe("email is gated on a verified sending domain", () => {
  it("is disabled while RESEND_FROM is unset", () => {
    expect(emailEnabled()).toBe(false);
  });

  it("is enabled once a from address exists", () => {
    process.env.RESEND_FROM = "editorial@journal.example.org";
    expect(emailEnabled()).toBe(true);
  });

  it("explains why rather than failing silently", async () => {
    const outcome = await notifyEditors(proposal);
    expect(outcome.sent).toBe(false);
    if (!outcome.sent) {
      expect(outcome.reason).toContain("RESEND_FROM");
      // The gmail limitation is the actual reason this is off, so the message
      // has to say so or someone will spend an afternoon on it.
      expect(outcome.reason).toContain("gmail.com cannot be a sender");
    }
  });

  it("reports failure rather than throwing", async () => {
    // A proposal that reached the database has been received. If notification
    // then fails, the submitter must still see success -- this is the contract
    // that makes that safe.
    await expect(notifyEditors(proposal)).resolves.toBeDefined();
  });
});

describe("editorial address", () => {
  it("comes from the environment", () => {
    expect(editorialAddress()).toBe("editors@example.org");
  });
});
