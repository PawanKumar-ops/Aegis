const ALLOWED_BIAS = ["Bullish", "Bearish", "Neutral"];
const ALLOWED_EVENT_TYPES = ["earnings", "dividend", "buyback", "promoter_change", "regulatory", "macro", "other"];
const ALLOWED_DIRECTION = ["bullish", "bearish", "neutral"];

export function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function toIsoTime(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

export function clampScore(value, max = 10) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(numeric, max));
}

export function parseModelJson(raw) {
  const text = safeText(raw).replace(/```json\s*/gi, "").replace(/```/g, "");
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) return null;

  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return null;
  }
}

export function validateModelAnalysis(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Model payload is not an object." };
  }

  const bias = safeText(input.bias);
  const confidence = Number(input.confidence);
  const reasoning = safeText(input.reasoning);

  if (!ALLOWED_BIAS.includes(bias)) {
    return { ok: false, error: `bias must be one of: ${ALLOWED_BIAS.join(", ")}.` };
  }
  if (Number.isNaN(confidence) || confidence < 0 || confidence > 10) {
    return { ok: false, error: "confidence must be a number between 0 and 10." };
  }
  if (!reasoning) {
    return { ok: false, error: "reasoning is required." };
  }

  return {
    ok: true,
    data: {
      bias,
      confidence,
      reasoning,
    },
  };
}

export function validateEdgeLlmSummary(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "LLM payload is not an object." };
  }

  const event_type = safeText(input.event_type).toLowerCase();
  const direction = safeText(input.direction).toLowerCase();
  const confidence = Number(input.confidence);
  const reasoning = safeText(input.reasoning);

  if (!ALLOWED_EVENT_TYPES.includes(event_type)) {
    return { ok: false, error: `event_type must be one of: ${ALLOWED_EVENT_TYPES.join(", ")}.` };
  }

  if (!ALLOWED_DIRECTION.includes(direction)) {
    return { ok: false, error: `direction must be one of: ${ALLOWED_DIRECTION.join(", ")}.` };
  }

  if (Number.isNaN(confidence) || confidence < 0 || confidence > 10) {
    return { ok: false, error: "confidence must be a number between 0 and 10." };
  }

  if (!reasoning) {
    return { ok: false, error: "reasoning is required." };
  }

  return {
    ok: true,
    data: {
      event_type,
      direction,
      confidence,
      reasoning,
    },
  };
}

export function validateLlmEventOutput(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "LLM payload is not an object." };
  }

  const event_type = safeText(input.event_type).toLowerCase();
  const direction = safeText(input.direction).toLowerCase();
  const reasoning = safeText(input.reasoning);

  if (!ALLOWED_EVENT_TYPES.includes(event_type)) {
    return { ok: false, error: `event_type must be one of: ${ALLOWED_EVENT_TYPES.join(", ")}.` };
  }

  if (!ALLOWED_DIRECTION.includes(direction)) {
    return { ok: false, error: `direction must be one of: ${ALLOWED_DIRECTION.join(", ")}.` };
  }

  if (!reasoning) {
    return { ok: false, error: "reasoning is required." };
  }

  const materiality_score = clampScore(input.materiality_score, 10);
  const surprise_score = clampScore(input.surprise_score, 10);
  const impact_score = clampScore(input.impact_score, 10);
  const confidence = clampScore(input.confidence, 10);

  return {
    ok: true,
    data: {
      event_type,
      direction,
      materiality_score,
      surprise_score,
      impact_score,
      confidence,
      reasoning,
    },
  };
}
