import { processFeed } from "@/core/feedProcessor";
import { classifyEvent } from "@/core/eventClassifier";
import { evaluateSurprise } from "@/core/surpriseEngine";
import { evaluateImpact } from "@/core/impactEngine";
import { applyRiskFilter } from "@/core/riskEngine";
import { confirmLiquidity } from "@/core/liquidityEngine";
import { evaluateMarketRegime } from "@/core/regimeEngine";
import { calculatePositionSize } from "@/core/positionSizer";
import { simulatePaperTrade } from "@/execution/paperBroker";
import { analyzeWithOpenAI } from "@/services/openaiService";
import { analyzeWithGemini } from "@/services/geminiService";
import { fetchNseAnnouncements } from "@/services/nseService";
import { fetchTier1RssFeeds } from "@/services/rssService";

function logJson(stage, payload) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      stage,
      ...payload,
    })
  );
}

function pickModelOutput(openai, gemini) {
  const candidates = [openai, gemini].filter((item) => item?.ok && item?.analysis);
  if (!candidates.length) {
    return {
      event_type: "other",
      direction: "neutral",
      confidence: 0,
      reasoning: "No valid LLM output available.",
      source_model: "fallback",
    };
  }

  const selected = candidates.sort((a, b) => Number(b.analysis.confidence || 0) - Number(a.analysis.confidence || 0))[0];
  return {
    ...selected.analysis,
    source_model: selected === openai ? "openai" : "gemini",
  };
}

export async function orchestrator() {
  try {
    // 1-2 Fetch primary + secondary sources
    const [nse, rss] = await Promise.all([fetchNseAnnouncements(), fetchTier1RssFeeds()]);

    // 3-4 Normalize + dedupe + sort + build feed
    const combinedRawFeed = [...(nse.items || []), ...(rss.items || [])];
    const eventFeed = processFeed(combinedRawFeed);
    const topEvent = eventFeed[0] || {
      symbol: "UNKNOWN",
      type: "unknown",
      title: "No event available",
      description: "No event available",
      time: new Date().toISOString(),
    };

    logJson("raw_event", { topEvent, feed_count: eventFeed.length });

    // 5 Event classification
    const classified = classifyEvent(topEvent);
    logJson("classified_event", classified);

    // AI layer (separate services)
    const [openai, gemini] = await Promise.all([analyzeWithOpenAI(topEvent), analyzeWithGemini(topEvent)]);
    const llmDecision = pickModelOutput(openai, gemini);

    // 6 Surprise
    const surprise = evaluateSurprise(topEvent, {
      ...classified,
      confidence: Math.max(Number(classified.confidence || 0), Number(llmDecision.confidence || 0)),
    });
    logJson("surprise_score", surprise);

    // 7 Impact
    const impact = evaluateImpact({
      classification: {
        event_type: llmDecision.event_type || classified.event_type,
        direction: llmDecision.direction || classified.direction,
      },
      surprise,
      aiConfidence: llmDecision.confidence,
    });
    logJson("impact_score", impact);

    // 8 Risk + 9 Liquidity + 10 Regime
    const liquidity = confirmLiquidity({ event_type: llmDecision.event_type || classified.event_type });
    const regime = evaluateMarketRegime();

    const risk = applyRiskFilter({
      confidence: llmDecision.confidence,
      surprise_score: surprise.surprise_score,
      impact_score: impact.impact_score,
      liquidity_confirmed: liquidity.confirm_liquidity,
      regime_ok: regime.regime_ok,
    });
    logJson("trade_decision", { risk, liquidity, regime });

    // 11 Position sizing
    const entryPrice = Number(process.env.DEFAULT_ENTRY_PRICE || 100);
    const sizing = risk.should_trade
      ? calculatePositionSize({
          capital: Number(process.env.TRADING_CAPITAL || 1000000),
          entry_price: entryPrice,
          direction: impact.trade_direction,
        })
      : { stop_price: 0, quantity: 0, risk_amount: 0 };
    logJson("position_sizing", sizing);

    // 12 Paper execution
    const execution = risk.should_trade
      ? await simulatePaperTrade({
          symbol: topEvent.symbol,
          direction: impact.trade_direction,
          entry_price: entryPrice,
          stop_price: sizing.stop_price,
          quantity: sizing.quantity,
        })
      : { ok: false, trade: null, error: { code: "TRADE_BLOCKED", message: "Risk filter blocked trade." } };
    logJson("execution_result", execution);

    // 13 Structured logging done above
    // 14 Return final structured result with UI-required top fields
    return {
      ok: true,
      symbol: topEvent.symbol,
      source_type: topEvent.type,
      title: topEvent.title,
      llm_summary: {
        event_type: llmDecision.event_type || classified.event_type,
        direction: llmDecision.direction || classified.direction,
        surprise_score: surprise.surprise_score,
        impact_score: impact.impact_score,
        confidence: llmDecision.confidence,
        reasoning: llmDecision.reasoning,
      },
      trade: {
        should_trade: risk.should_trade,
        reasons_if_rejected: risk.reasons_if_rejected,
        position: sizing,
        execution,
      },
      diagnostics: {
        feed_count: eventFeed.length,
        model_outputs: {
          openai,
          gemini,
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      symbol: "UNKNOWN",
      source_type: "unknown",
      title: "orchestrator_error",
      llm_summary: {
        event_type: "other",
        direction: "neutral",
        surprise_score: 0,
        impact_score: 0,
        confidence: 0,
        reasoning: "Orchestrator failure fallback",
      },
      trade: {
        should_trade: false,
        reasons_if_rejected: ["orchestrator_failed"],
        position: { stop_price: 0, quantity: 0, risk_amount: 0 },
        execution: null,
      },
      error: {
        code: "ORCHESTRATOR_ERROR",
        message: error?.message || "Unexpected orchestrator failure.",
      },
    };
  }
}
