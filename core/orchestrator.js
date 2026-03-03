import { processFeed } from "@/core/feedProcessor";
import { applyRiskFilter } from "@/core/riskEngine";
import { confirmLiquidity } from "@/core/liquidityEngine";
import { evaluateMarketRegime } from "@/core/regimeEngine";
import { calculatePositionSize } from "@/core/positionSizer";
import { runLlmEventEngine } from "@/core/llmEventEngine";
import { simulatePaperTrade } from "@/execution/paperBroker";
import { fetchNseAnnouncements } from "@/services/nseService";
import { fetchTier1RssFeeds } from "@/services/rssService";

function defaultEvent() {
  return {
    symbol: "UNKNOWN",
    type: "unknown",
    title: "No event available",
    description: "No event available",
    time: new Date().toISOString(),
  };
}

export async function orchestrator() {
  const timestamps = {
    requested_at: new Date().toISOString(),
    processed_at: null,
  };

  try {
    const [nse, rss] = await Promise.all([fetchNseAnnouncements(), fetchTier1RssFeeds()]);

    const combinedRawFeed = [...(nse.items || []), ...(rss.items || [])];
    const eventFeed = processFeed(combinedRawFeed);
    const topEvent = eventFeed[0] || defaultEvent();

    const llmSummary = await runLlmEventEngine(topEvent);
    const liquidity = confirmLiquidity({ event_type: llmSummary.event_type });
    const regime = evaluateMarketRegime();

    const risk = applyRiskFilter({
      confidence: llmSummary.confidence,
      surprise_score: llmSummary.surprise_score,
      impact_score: llmSummary.impact_score,
      liquidity_confirmed: liquidity.confirm_liquidity,
      regime_ok: regime.regime_ok,
    });

    const entryPrice = Number(process.env.DEFAULT_ENTRY_PRICE || 100);
    const positionSizing = risk.should_trade
      ? calculatePositionSize({
          capital: Number(process.env.TRADING_CAPITAL || 1000000),
          entry_price: entryPrice,
          direction: llmSummary.direction,
        })
      : { stop_price: 0, quantity: 0, risk_amount: 0 };

    const executionResult = risk.should_trade
      ? await simulatePaperTrade({
          symbol: topEvent.symbol,
          direction: llmSummary.direction,
          entry_price: entryPrice,
          stop_price: positionSizing.stop_price,
          quantity: positionSizing.quantity,
        })
      : { ok: false, trade: null, error: { code: "TRADE_BLOCKED", message: "Risk filter blocked trade." } };

    timestamps.processed_at = new Date().toISOString();

    const sourceErrors = [nse.error?.message, rss.error?.message].filter(Boolean);

    return {
      ok: true,
      symbol: topEvent.symbol,
      source_type: topEvent.type,
      title: topEvent.title,
      description: topEvent.description,
      timestamps,
      fetched_news: {
        nse_announcements: nse.items || [],
        combined_feed: eventFeed,
        rss_news: rss.items || [],
        source_errors: sourceErrors,
      },
      llm_summary: {
        event_type: llmSummary.event_type,
        direction: llmSummary.direction,
        materiality_score: llmSummary.materiality_score,
        surprise_score: llmSummary.surprise_score,
        impact_score: llmSummary.impact_score,
        confidence: llmSummary.confidence,
        reasoning: llmSummary.reasoning,
        model_meta: llmSummary.model_meta,
      },
      liquidity,
      regime,
      risk,
      position_sizing: positionSizing,
      execution_result: executionResult,
    };
  } catch (error) {
    timestamps.processed_at = new Date().toISOString();

    return {
      ok: false,
      symbol: "UNKNOWN",
      source_type: "unknown",
      title: "orchestrator_error",
      description: "Orchestrator failure fallback",
      timestamps,
      llm_summary: {
        event_type: "other",
        direction: "neutral",
        materiality_score: 0,
        surprise_score: 0,
        impact_score: 0,
        confidence: 0,
        reasoning: "Orchestrator failure fallback",
        model_meta: {
          selected_model: "fallback",
          providers_ok: [],
          providers_failed: ["gemini"],
        },
      },
      liquidity: {
        confirm_liquidity: false,
        metrics: { relativeVolume: 0, atrExpansion: 0, breakout: false },
      },
      regime: {
        regime_ok: false,
        regime_details: { indexTrendDirection: "sideways", volatilityState: "high" },
      },
      risk: {
        should_trade: false,
        reasons_if_rejected: ["orchestrator_failed"],
        thresholds: {
          confidence: Number(process.env.CONFIDENCE_THRESHOLD || 7),
          surprise_score: Number(process.env.SURPRISE_TRADE_THRESHOLD || 6),
          impact_score: Number(process.env.IMPACT_SCORE_THRESHOLD || 6),
        },
      },
      position_sizing: { stop_price: 0, quantity: 0, risk_amount: 0 },
      execution_result: {
        ok: false,
        trade: null,
        error: { code: "ORCHESTRATOR_ERROR", message: error?.message || "Unexpected orchestrator failure." },
      },
    };
  }
}
