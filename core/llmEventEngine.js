import { analyzeWithOpenAI } from "@/services/openaiService";
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

function score(entry) {
  return clampScore(entry?.confidence, 10);
}

function mergeNumeric(primary, secondary, key) {
  const first = clampScore(primary?.[key], 10);
  const second = clampScore(secondary?.[key], 10);

  if (first === 0 && second === 0) return 0;
  if (first === 0) return second;
  if (second === 0) return first;

  const primaryWeight = Math.max(score(primary), 1);
  const secondaryWeight = Math.max(score(secondary), 1);
  const weighted = (first * primaryWeight + second * secondaryWeight) / (primaryWeight + secondaryWeight);
  return Number(weighted.toFixed(2));
}

function mergeAnalyses(openaiAnalysis, geminiAnalysis) {
  const candidates = [
    { provider: "openai", analysis: openaiAnalysis },
    { provider: "gemini", analysis: geminiAnalysis },
  ].filter((entry) => entry.analysis);

  if (!candidates.length) {
    return {
      ...DEFAULT_RESULT,
      model_meta: {
        selected_model: "fallback",
        providers_ok: [],
        providers_failed: ["openai", "gemini"],
      },
    };
  }

  const sorted = [...candidates].sort((a, b) => score(b.analysis) - score(a.analysis));
  const primary = sorted[0];
  const secondary = sorted[1];

  const event_type = primary.analysis.event_type || DEFAULT_RESULT.event_type;
  const direction = primary.analysis.direction || DEFAULT_RESULT.direction;

  const merged = {
    event_type,
    direction,
    materiality_score: mergeNumeric(primary.analysis, secondary?.analysis, "materiality_score"),
    surprise_score: mergeNumeric(primary.analysis, secondary?.analysis, "surprise_score"),
    impact_score: mergeNumeric(primary.analysis, secondary?.analysis, "impact_score"),
    confidence: mergeNumeric(primary.analysis, secondary?.analysis, "confidence"),
    reasoning: [primary.analysis.reasoning, secondary?.analysis?.reasoning].filter(Boolean).join("\n\n---\n\n"),
    model_meta: {
      selected_model: primary.provider,
      providers_ok: candidates.map((entry) => entry.provider),
      providers_failed: ["openai", "gemini"].filter((provider) => !candidates.some((entry) => entry.provider === provider)),
    },
  };

  return merged;
}

export async function runLlmEventEngine(event = {}) {
  const [openai, gemini] = await Promise.all([analyzeWithOpenAI(event), analyzeWithGemini(event)]);

  const merged = mergeAnalyses(openai.ok ? openai.analysis : null, gemini.ok ? gemini.analysis : null);

  return {
    ...merged,
    model_meta: {
      ...merged.model_meta,
      provider_status: {
        openai: { ok: openai.ok, error: openai.error || null },
        gemini: { ok: gemini.ok, error: gemini.error || null },
      },
    },
  };
}
