import { fetchWithTimeout } from "@/utils/timeout";
import { parseModelJson, safeText, validateEdgeLlmSummary } from "@/utils/validators";

const SYSTEM_PROMPT = [
  "You are an event-driven Indian equities analyst.",
  "Return strictly JSON with keys: event_type, direction, confidence, reasoning.",
  "event_type must be one of earnings|dividend|buyback|promoter_change|regulatory|macro|other.",
  "direction must be one of bullish|bearish|neutral.",
  "confidence must be in the range 0..10.",
].join(" ");

function buildPrompt(event) {
  return [
    SYSTEM_PROMPT,
    `symbol: ${safeText(event?.symbol) || "UNKNOWN"}`,
    `source_type: ${safeText(event?.type) || "unknown"}`,
    `title: ${safeText(event?.title) || "Untitled"}`,
    `description: ${safeText(event?.description) || "No description"}`,
  ].join("\n");
}

export async function analyzeWithGemini(event = {}) {
  const apiKey = safeText(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return {
      ok: false,
      analysis: null,
      raw: null,
      error: { code: "GEMINI_DISABLED", message: "GEMINI_API_KEY is missing." },
    };
  }

  try {
    const model = safeText(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: buildPrompt(event) }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const result = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!result?.ok) {
      return { ok: false, analysis: null, raw: null, error: result.error };
    }

    const payload = await result.response.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") || "";
    const parsed = parseModelJson(raw);
    const validated = validateEdgeLlmSummary(parsed);

    if (!validated.ok) {
      return {
        ok: false,
        analysis: null,
        raw,
        error: { code: "GEMINI_INVALID_OUTPUT", message: validated.error },
      };
    }

    return { ok: true, analysis: validated.data, raw, error: null };
  } catch (error) {
    return {
      ok: false,
      analysis: null,
      raw: null,
      error: { code: "GEMINI_ERROR", message: error?.message || "Gemini call failed." },
    };
  }
}
