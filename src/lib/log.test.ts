// @vitest-environment node
/**
 * Slice 5.0(c): log redaction (spec §13). Recipient emails,
 * invitation tokens, API keys, support notes, and cookies never
 * appear in captured log output — they surface as [REDACTED].
 */
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./log";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { lines, stream };
}

describe("log redaction (Slice 5.0c)", () => {
  it("redacts emails, tokens, API keys and notes in a payload", () => {
    const { lines, stream } = capture();
    const logger = createLogger(stream);
    logger.info({
      msg: "payout event",
      beneficiary: { invitationEmail: "user@example.com", payPalRecipientEmail: "p.user@example.com" },
      invitationToken: "super-secret-token",
      apiKey: "sk-live-123",
      supportNote: "PRIVATE family note",
      authHeader: "Bearer abc",
    });

    const output = lines.join("");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("user@example.com");
    expect(output).not.toContain("p.user@example.com");
    expect(output).not.toContain("super-secret-token");
    expect(output).not.toContain("sk-live-123");
    expect(output).not.toContain("PRIVATE family note");
    expect(output).not.toContain("abc");
  });
});
