const DEFAULT_CONFIDENCE_THRESHOLD = Number(process.env.CONFIDENCE_THRESHOLD || 7);
const SPARSE_FEED_THRESHOLD = Number(process.env.SPARSE_FEED_THRESHOLD || 3);
const SPARSE_FEED_PENALTY = Number(process.env.SPARSE_FEED_PENALTY || 1);

export async function confirmWithTechnicals() {
  return true;
}

function applySparseFeedPenalty(confidence, feedCount) {
  if (feedCount >= SPARSE_FEED_THRESHOLD) return confidence;
  return Math.max(0, confidence - SPARSE_FEED_PENALTY);
}

export async function evaluateRiskGate({ openai, gemini, feedCount }) {
  try {
    const analyses = [openai?.analysis, gemini?.analysis].filter(Boolean);
    if (!analyses.length) {
      return {
        approved: false,
        reason: "No valid AI analysis available.",
        effectiveConfidence: 0,
      };
    }

    const adjusted = analyses.map((a) => ({ ...a, confidence: applySparseFeedPenalty(a.confidence, feedCount) }));

    const agreementRequired = adjusted.length === 2;
    const agreed = !agreementRequired || adjusted[0].bias === adjusted[1].bias;
    const minConfidence = Math.min(...adjusted.map((a) => a.confidence));

    if (!agreed) {
      return { approved: false, reason: "Model bias disagreement.", effectiveConfidence: minConfidence };
    }

    if (minConfidence < DEFAULT_CONFIDENCE_THRESHOLD) {
      return {
        approved: false,
        reason: `Confidence ${minConfidence.toFixed(1)} below threshold ${DEFAULT_CONFIDENCE_THRESHOLD}.`,
        effectiveConfidence: minConfidence,
      };
    }

    return {
      approved: true,
      reason: "Risk gate passed.",
      effectiveConfidence: minConfidence,
      bias: adjusted[0].bias,
    };
  } catch (error) {
    return {
      approved: false,
      reason: `Risk evaluation failed: ${error?.message || "unknown error"}`,
      effectiveConfidence: 0,
    };
  }
}
