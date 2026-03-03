import { NextResponse } from "next/server";
import { orchestrator } from "@/core/orchestrator";

export async function GET() {
  try {
    const result = await orchestrator();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "EDGE_ENGINE_ROUTE_ERROR",
          message: error?.message || "Failed to execute edge engine route.",
        },
      },
      { status: 500 }
    );
  }
}
