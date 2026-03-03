const ALLOWED_BIAS = ["Bullish", "Bearish", "Neutral"];

export function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function toIsoTime(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
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
