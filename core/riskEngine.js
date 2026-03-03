const CONFIDENCE_THRESHOLD = Number(process.env.CONFIDENCE_THRESHOLD || 7);
const SURPRISE_THRESHOLD = Number(process.env.SURPRISE_TRADE_THRESHOLD || 6);
const IMPACT_THRESHOLD = Number(process.env.IMPACT_SCORE_THRESHOLD || 6);

export function applyRiskFilter({
  confidence = 0,
  surprise_score = 0,
  impact_score = 0,
  liquidity_confirmed = false,
  regime_ok = false,
} = {}) {
  const reasons_if_rejected = [];

  if (Number(confidence) < CONFIDENCE_THRESHOLD) {
    reasons_if_rejected.push(`confidence ${confidence} below ${CONFIDENCE_THRESHOLD}`);
  }

  if (Number(surprise_score) < SURPRISE_THRESHOLD) {
    reasons_if_rejected.push(`surprise_score ${surprise_score} below ${SURPRISE_THRESHOLD}`);
  }

  if (Number(impact_score) < IMPACT_THRESHOLD) {
    reasons_if_rejected.push(`impact_score ${impact_score} below ${IMPACT_THRESHOLD}`);
  }

  if (!liquidity_confirmed) {
    reasons_if_rejected.push("liquidity confirmation failed");
  }

  if (!regime_ok) {
    reasons_if_rejected.push("market regime filter failed");
  }

  return {
    should_trade: reasons_if_rejected.length === 0,
    reasons_if_rejected,
    thresholds: {
      confidence: CONFIDENCE_THRESHOLD,
      surprise_score: SURPRISE_THRESHOLD,
      impact_score: IMPACT_THRESHOLD,
    },
  };
}
