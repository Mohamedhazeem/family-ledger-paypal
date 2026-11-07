import { NextResponse } from "next/server";
import { PingAiProvider } from "@/application/use-cases/ping-ai-provider";
import { createAiProvider } from "@/infrastructure/ai/factory";

/**
 * GET /api/ai/ping (Slice 2.1): returns the configured AI provider
 * and model name. Config probe only — no user data, no secrets.
 */
export async function GET() {
  try {
    const result = await new PingAiProvider(createAiProvider()).execute();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI provider misconfigured" },
      { status: 500 },
    );
  }
}
