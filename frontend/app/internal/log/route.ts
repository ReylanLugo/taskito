import { NextResponse } from "next/server";
import { logToLoki } from "@/app/actions/logToLoki";
import type { FrontendLog } from "@/types/Loki";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FrontendLog;
    // Basic validation
    if (!body || typeof body.message !== "string" || typeof body.level !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await logToLoki(body);
    if (!result.ok) {
      // Surface push errors in server logs for quick diagnosis
      console.error("Loki push failed:", result.error);
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Simple test endpoint: hitting GET /internal/log pushes a test log to Loki.
export async function GET() {
  const result = await logToLoki({
    level: "info",
    message: "frontend log test",
    labels: { channel: "test" },
    meta: { ts: Date.now(), via: "GET /internal/log" },
  });
  if (!result.ok) {
    console.error("Loki push failed (GET):", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, message: "test log sent" });
}
