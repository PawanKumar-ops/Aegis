import { NextResponse } from "next/server";
import { orchestrator } from "@/core/orchestrator";

export async function GET() {
  const result = await orchestrator();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
