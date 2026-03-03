import { analyzeWithGemini } from "@/services/geminiService";
import { clampScore } from "@/utils/validators";

const DEFAULT_RESULT = {
  event_type: "other",
  direction: "neutral",
  materiality_score: 0,
  surprise_score: 0,
  impact_score: 0,
  confidence: 0,
  reasoning: "No valid model output available.",
};

function mergeAnalysis(geminiAnalysis) {
  if (!geminiAnalysis) {
    return {
      ...DEFAULT_RESULT,
      model_meta: {
        selected_model: "fallback",
        providers_ok: [],
        providers_failed: ["gemini"],
      },
    };
  }

  return {
    event_type: geminiAnalysis.event_type || DEFAULT_RESULT.event_type,
    direction: geminiAnalysis.direction || DEFAULT_RESULT.direction,
    materiality_score: clampScore(geminiAnalysis.materiality_score, 10),
    surprise_score: clampScore(geminiAnalysis.surprise_score, 10),
    impact_score: clampScore(geminiAnalysis.impact_score, 10),
    confidence: clampScore(geminiAnalysis.confidence, 10),
    reasoning: geminiAnalysis.reasoning || DEFAULT_RESULT.reasoning,
    model_meta: {
      selected_model: "gemini",
      providers_ok: ["gemini"],
      providers_failed: [],
    },
  };
}

export async function runLlmEventEngine(event = {}) {
  const gemini = await analyzeWithGemini(event);

  const merged = mergeAnalysis(gemini.ok ? gemini.analysis : null);

  return {
    ...merged,
    model_meta: {
      ...merged.model_meta,
      provider_status: {
        gemini: { ok: gemini.ok, analysis: gemini.analysis || null, error: gemini.error || null },
      },
    },
  };
}
