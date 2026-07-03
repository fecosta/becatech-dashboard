import { NextResponse } from "next/server";
import { handleJotformWebhook } from "@/lib/jotform/webhook";

// POST /api/jotform/webhook — placeholder ingestion endpoint (no live JotForm sync).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "FAILED", error: "Invalid JSON" }, { status: 400 });
  }

  // Optional shared-secret check (skipped when JOTFORM_WEBHOOK_SECRET is unset).
  const secret = process.env.JOTFORM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ status: "FAILED", error: "Unauthorized" }, { status: 401 });
  }

  const result = await handleJotformWebhook(body);
  const httpStatus = result.status === "FAILED" ? 422 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
