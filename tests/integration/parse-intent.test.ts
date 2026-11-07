/**
 * @vitest-environment node
 */
/**
 * Slice 2.5 acceptance tests (integration): POST /api/ai/parse-intent
 * is a thin handler over the ParseSupportIntent use case. The AI
 * provider HTTP endpoint is intercepted with MSW — the real external
 * service is never hit. The session module is mocked so authz tests
 * don't need a request context.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

const sessionState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/lib/auth/session", () => ({
  requireSession: async () => sessionState.session,
}));

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
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
}

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function post(body: unknown): Request {
  return new Request("http://localhost/api/ai/parse-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/parse-intent (Slice 2.5)", () => {
  beforeAll(() => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_API_KEY = "sk-test-key";
    process.env.AI_MODEL = "test-model";
    process.env.AI_BASE_URL = BASE_URL;
  });

  beforeAll(() => {
    sessionState.session = { user: { id: "coordinator-1", email: "coord@example.com" } };
  });

  it("returns the extracted plan for a valid request", async () => {
    server.use(http.post(`${BASE_URL}/chat/completions`, () => completionResponse(VALID_PLAN_JSON)));
    const { POST } = await import("@/app/api/ai/parse-intent/route");
    const res = await POST(post({ note: "$300 for rent", amountMinor: 50000, currency: "USD" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).toMatchObject({ category: "Rent", amountText: "300.00" });
    expect(body.requiresClarification).toBe(false);
  });

  it("rejects invalid model output with 502", async () => {
    server.use(http.post(`${BASE_URL}/chat/completions`, () => completionResponse("not json")));
    const { POST } = await import("@/app/api/ai/parse-intent/route");
    const res = await POST(post({ note: "$300 for rent", amountMinor: 50000, currency: "USD" }));
    expect(res.status).toBe(502);
  });

  it("rejects a malformed request body with 400", async () => {
    const { POST } = await import("@/app/api/ai/parse-intent/route");
    const res = await POST(post({ note: "$300 for rent", currency: "USD" }));
    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated requests with 401", async () => {
    sessionState.session = null;
    const { POST } = await import("@/app/api/ai/parse-intent/route");
    const res = await POST(post({ note: "$300 for rent", amountMinor: 50000, currency: "USD" }));
    expect(res.status).toBe(401);
    sessionState.session = { user: { id: "coordinator-1", email: "coord@example.com" } };
  });
});
