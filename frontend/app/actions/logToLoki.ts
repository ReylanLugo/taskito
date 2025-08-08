"use server";
import { FrontendLog } from "@/types/Loki";
import "server-only";

/**
 * Server Action: Push a frontend log entry to Loki using the HTTP push API.
 * This executes on the server, so we can safely reach the Loki service in Docker.
 *
 * Requires env var LOKI_URL in frontend container, default: http://loki:3100
 * The log line is JSON-encoded to preserve structure.
 */
export async function logToLoki({
  level,
  message,
  meta,
  labels,
}: FrontendLog): Promise<{ ok: true } | { ok: false; error: string }> {
  const baseUrl = process.env.LOKI_URL ?? "http://loki:3100";
  const url = `${baseUrl.replace(/\/$/, "")}/loki/api/v1/push`;

  // Loki expects nanosecond timestamps as strings. Avoid BigInt to support lower TS targets.
  // Convert ms to ns by appending 6 zeros.
  const tsNs = `${Date.now()}000000`;

  const lineObj = {
    message,
    level,
    meta: meta ?? {},
    source: "frontend",
  };

  // Base labels for this stream
  const baseLabels: Record<string, string> = {
    application: "taskito-frontend",
    level,
    source: "frontend",
    ...Object.fromEntries(
      Object.entries(labels ?? {}).map(([k, v]) => [k, String(v)])
    ),
  };

  const body = {
    streams: [
      {
        stream: baseLabels,
        values: [[tsNs, JSON.stringify(lineObj)]],
      },
    ],
  };

  try {
    console.log("Pushing log to Loki:", body, url);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Avoid Next caching
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Loki push failed:", text);
      return {
        ok: false,
        error: `Loki push failed: ${res.status} ${res.statusText} ${text}`,
      };
    }

    return { ok: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Loki push failed:", error);
    return { ok: false, error };
  }
}
