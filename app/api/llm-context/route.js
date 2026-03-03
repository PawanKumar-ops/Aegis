import { NextResponse } from "next/server";
import {
  analyzeWithGemini,
  analyzeWithOpenAI,
  buildFeedSummary,
  fetchNSEAnnouncements,
  fetchNewsApiHeadlines,
  fetchTier1News,
  normalizeAndLimitFeed,
} from "@/lib/server/llmContext";

export async function GET() {
  try {
    const [nse, tier1Rss, premiumNews] = await Promise.all([
      fetchNSEAnnouncements(),
      fetchTier1News(),
      fetchNewsApiHeadlines(),
    ]);

    const combinedFeed = normalizeAndLimitFeed([
      ...nse.items,
      ...tier1Rss.items,
      ...premiumNews.items,
    ]);

    const summaryText = buildFeedSummary(combinedFeed);

    // Dual-model analysis reduces dependence on one provider and supports cross-checking.
    const [openai, gemini] = await Promise.all([
      analyzeWithOpenAI(summaryText),
      analyzeWithGemini(summaryText),
    ]);

    const errors = [nse.error, tier1Rss.error, premiumNews.error, openai.error, gemini.error].filter(
      Boolean
    );

    return NextResponse.json({
      feed: combinedFeed,
      summaryText,
      ai: {
        openai,
        gemini,
      },
      errors,
      timestamp: new Date().toISOString(),
      extensions: {
        sseOrWebsocket: "Stream incremental feed updates to clients for lower latency monitoring.",
        databaseStorage: "Persist normalized feed in PostgreSQL/Timescale for backtesting and replay.",
        tradingSignals:
          "Map model bias/confidence to rule-based thresholds before sending execution intents.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        feed: [],
        ai: { openai: null, gemini: null },
        errors: [`Route failure: ${error.message}`],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
