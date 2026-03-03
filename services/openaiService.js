import { fetchWithTimeout } from "@/utils/timeout";
import { parseModelJson, safeText, validateLlmEventOutput } from "@/utils/validators";

const SYSTEM_PROMPT = [
  "You are an event-driven Indian equities analyst.",
  "Return strictly JSON with keys: event_type, direction, materiality_score, surprise_score, impact_score, confidence, reasoning.",
  "event_type must be one of earnings|dividend|buyback|promoter_change|regulatory|macro|other.",
  "direction must be one of bullish|bearish|neutral.",
  "materiality_score, surprise_score, impact_score, confidence must be in range 0..10.",
  "reasoning should be concise and factual.",
].join(" ");

function buildPrompt(event) {
  return [
    "Analyze this market event and quantify materiality, surprise, and impact.",
    `symbol: ${safeText(event?.symbol) || "UNKNOWN"}`,
    `source_type: ${safeText(event?.type) || "unknown"}`,
    `title: ${safeText(event?.title) || "Untitled"}`,
    `description: ${safeText(event?.description) || "No description"}`,
  ].join("\n");
}

export async function analyzeWithOpenAI(event = {}) {
  const apiKey = safeText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return {
      ok: false,
      analysis: null,
      error: { code: "OPENAI_DISABLED", message: "OPENAI_API_KEY is missing." },
    };
  }

  try {
    const model = safeText(process.env.OPENAI_MODEL) || "gpt-4o-mini";
    const body = {
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(event) },
      ],
    };

    const result = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!result?.ok) {
      return { ok: false, analysis: null, error: result.error };
    }

    const payload = await result.response.json();
    const parsed = parseModelJson(payload?.choices?.[0]?.message?.content || "");
    const validated = validateLlmEventOutput(parsed);

    if (!validated.ok) {
      return {
        ok: false,
        analysis: null,
        error: { code: "OPENAI_INVALID_OUTPUT", message: validated.error },
      };
    }

    return { ok: true, analysis: validated.data, error: null };
  } catch (error) {
    return {
      ok: false,
      analysis: null,
      error: { code: "OPENAI_ERROR", message: error?.message || "OpenAI call failed." },
    };
  }
}
