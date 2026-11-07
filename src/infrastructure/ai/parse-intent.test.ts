/**
 * @vitest-environment node
 */
/**
 * Slice 2.3 acceptance test (adapter): model output is validated by
 * the extraction schema before it is returned (spec §12A). The
 * OpenAI-compatible HTTP endpoint is intercepted with MSW — the
 * real external service is never hit.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { OpenAiAdapter } from "./openai";

const BASE_URL = "https://api.example.test/v1";
const VALID_PLAN_JSON = JSON.stringify({
  summary: "Proposed family support allocation",
  items: [
    { category: "Rent", amountText: "300.00", evidenceText: "$300 for rent", confidence: 0.99 },
  ],
  requiresClarification: false,
  clarificationQuestion: null,
});

function completionResponse(content: string) {
  return HttpResponse.json({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 1700000000,
    model: "test-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  });
}

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function adapter() {
  return new OpenAiAdapter({
    provider: "openai",
    apiKey: "sk-test-key",
    model: "test-model",
    baseURL: BASE_URL,
  });
}

describe("OpenAiAdapter.parseIntent schema validation (Slice 2.3)", () => {
  it("returns schema-validated plan for well-formed model output", async () => {
    server.use(
      http.post(`${BASE_URL}/chat/completions`, () => completionResponse(VALID_PLAN_JSON)),
    );
    const plan = await adapter().parseIntent({
      note: "$300 for rent",
      amountMinor: 50000n,
      currency: "USD",
    });
    expect(plan.items[0]!.category).toBe("Rent");
    expect(plan.items[0]!.amountText).toBe("300.00");
  });

  it("rejects model output that fails schema validation", async () => {
    server.use(
      http.post(
        `${BASE_URL}/chat/completions`,
        () => completionResponse("this is not json"),
      ),
    );
    await expect(
      adapter().parseIntent({ note: "$300 for rent", amountMinor: 50000n, currency: "USD" }),
    ).rejects.toThrow(/did not return valid JSON|failed schema validation/);
  });
});
