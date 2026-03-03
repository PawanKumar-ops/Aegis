import { processFeed, buildFeedSummary } from "@/core/feedProcessor";
import { evaluateRiskGate, confirmWithTechnicals } from "@/core/riskEngine";
import { calculatePositionSize } from "@/core/positionSizer";
import { placePaperOrder } from "@/execution/paperBroker";
import { analyzeWithOpenAI } from "@/services/openaiService";
import { analyzeWithGemini } from "@/services/geminiService";
import { fetchNseAnnouncements } from "@/services/nseService";
import { fetchTier1RssFeeds } from "@/services/rssService";
import { fetchNewsApiHeadlines } from "@/services/newsApiService";

function logJson(event, payload) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

export async function orchestrator() {
  try {
    const [nse, rss, newsApi] = await Promise.all([
      fetchNseAnnouncements(),
      fetchTier1RssFeeds(),
      fetchNewsApiHeadlines(),
    ]);

    const combinedRawFeed = [...nse.items, ...rss.items, ...newsApi.items];
    const combinedFeed = processFeed(combinedRawFeed);
    const summaryText = buildFeedSummary(combinedFeed);

    logJson("feed_snapshot", { itemCount: combinedFeed.length, feed: combinedFeed });

    const [openai, gemini] = await Promise.all([
      analyzeWithOpenAI(summaryText),
      analyzeWithGemini(summaryText),
    ]);

    logJson("ai_outputs", { openai, gemini });

    const riskDecision = await evaluateRiskGate({ openai, gemini, feedCount: combinedFeed.length });

    let tradeDecision = {
      shouldTrade: false,
      reason: riskDecision.reason,
      order: null,
      execution: null,
    };

    if (riskDecision.approved && combinedFeed.length > 0) {
      const symbol = combinedFeed[0].symbol;
      const technicalConfirmed = await confirmWithTechnicals(symbol);

      if (technicalConfirmed) {
        const sizing = calculatePositionSize({
          capital: process.env.TRADING_CAPITAL,
          entryPrice: Number(process.env.DEFAULT_ENTRY_PRICE || 100),
        });

        if (sizing.ok && sizing.data.quantity > 0) {
          const orderIntent = {
            symbol,
            side: riskDecision.bias === "Bearish" ? "SELL" : "BUY",
            quantity: sizing.data.quantity,
            stopLoss: sizing.data.stopLoss,
            confidence: riskDecision.effectiveConfidence,
            mode: "paper",
          };

          const execution = await placePaperOrder(orderIntent);
          tradeDecision = {
            shouldTrade: execution.ok,
            reason: execution.ok ? "Trade executed in paper mode." : execution.error?.message,
            order: orderIntent,
            execution,
          };
        } else {
          tradeDecision.reason = sizing.error?.message || "Position sizing blocked trade.";
        }
      } else {
        tradeDecision.reason = "Technical confirmation failed.";
      }
    }

    logJson("trade_decision", { riskDecision, tradeDecision });
    logJson("pnl_snapshot", { realizedPnl: 0, unrealizedPnl: 0, mode: "paper" });

    const errors = [nse.error, rss.error, newsApi.error, openai.error, gemini.error].filter(Boolean);

    return {
      ok: true,
      timestamp: new Date().toISOString(),
      combinedFeed,
      summaryText,
      openai,
      gemini,
      riskDecision,
      tradeDecision,
      errors,
    };
  } catch (error) {
    return {
      ok: false,
      timestamp: new Date().toISOString(),
      combinedFeed: [],
      summaryText: "",
      openai: { ok: false, analysis: null, error: { code: "ORCHESTRATOR_ERROR", message: "Not executed" } },
      gemini: { ok: false, analysis: null, error: { code: "ORCHESTRATOR_ERROR", message: "Not executed" } },
      riskDecision: { approved: false, reason: "Orchestrator failed.", effectiveConfidence: 0 },
      tradeDecision: { shouldTrade: false, reason: "Orchestrator failed." },
      errors: [{ code: "ORCHESTRATOR_ERROR", message: error?.message || "Unexpected orchestrator failure." }],
    };
  }
}
