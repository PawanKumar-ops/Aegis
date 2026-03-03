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

export async function analyzeWithGemini(feedSummary) {
  const apiKey = safeText(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return { ok: false, analysis: null, raw: null, error: { code: "GEMINI_DISABLED", message: "GEMINI_API_KEY is missing." } };
  }

  try {
    const model = safeText(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildPrompt(feedSummary)}` }] }],
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
    const validated = validateModelAnalysis(parsed);

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
    return { ok: false, analysis: null, raw: null, error: { code: "GEMINI_ERROR", message: error?.message || "Gemini call failed." } };
  }
}
