import { fetchWithTimeout } from "@/utils/timeout";
import { parseModelJson, safeText, validateModelAnalysis } from "@/utils/validators";

const SYSTEM_PROMPT = [
  "You are a risk-aware Indian equities event analyst.",
  "Return strictly JSON with keys: bias, confidence, reasoning.",
  "bias must be one of Bullish|Bearish|Neutral.",
  "confidence must be in the range 0..10.",
  "If event data is sparse, lower confidence.",
].join(" ");

function buildPrompt(feedSummary) {
  return ["Analyze this event feed for short-horizon directional bias.", "Return JSON only.", feedSummary || "No events available."].join("\n\n");
}

export async function analyzeWithOpenAI(feedSummary) {
  const apiKey = safeText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return { ok: false, analysis: null, raw: null, error: { code: "OPENAI_DISABLED", message: "OPENAI_API_KEY is missing." } };
  }

  try {
    const model = safeText(process.env.OPENAI_MODEL) || "gpt-4o-mini";
    const body = {
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(feedSummary) },
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
      return { ok: false, analysis: null, raw: null, error: result.error };
    }

    const payload = await result.response.json();
    const raw = payload?.choices?.[0]?.message?.content || "";
    const parsed = parseModelJson(raw);
    const validated = validateModelAnalysis(parsed);

    if (!validated.ok) {
      return {
        ok: false,
        analysis: null,
        raw,
        error: { code: "OPENAI_INVALID_OUTPUT", message: validated.error },
      };
    }

    return { ok: true, analysis: validated.data, raw, error: null };
  } catch (error) {
    return { ok: false, analysis: null, raw: null, error: { code: "OPENAI_ERROR", message: error?.message || "OpenAI call failed." } };
  }
}
