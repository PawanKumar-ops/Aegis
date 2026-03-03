const DEFAULT_IMPACT_THRESHOLD = Number(process.env.IMPACT_SCORE_THRESHOLD || 6);

const EVENT_WEIGHTS = {
  earnings: 3,
  dividend: 2,
  buyback: 3,
  promoter_change: 2,
  regulatory: 2,
  macro: 2,
  other: 1,
};

export function evaluateImpact({ classification = {}, surprise = {}, aiConfidence = 0 }) {
  try {
    const eventWeight = EVENT_WEIGHTS[classification.event_type] ?? EVENT_WEIGHTS.other;
    const surpriseComponent = Number(surprise.surprise_score || 0) * 0.4;
    const confidenceComponent = Number(aiConfidence || 0) * 0.3;
    const raw = eventWeight + surpriseComponent + confidenceComponent;
    const impact_score = Math.max(0, Math.min(10, Number(raw.toFixed(2))));

    return {
      impact_score,
      trade_direction: classification.direction || "neutral",
      trade_threshold: DEFAULT_IMPACT_THRESHOLD,
    };
  } catch {
    return {
      impact_score: 0,
      trade_direction: "neutral",
      trade_threshold: DEFAULT_IMPACT_THRESHOLD,
    };
  }
}
