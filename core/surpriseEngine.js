import { safeText } from "@/utils/validators";

const DEFAULT_SURPRISE_TRADE_THRESHOLD = Number(process.env.SURPRISE_TRADE_THRESHOLD || 6);

export function evaluateSurprise(event = {}, classification = {}) {
  try {
    const text = `${safeText(event.title)} ${safeText(event.description)}`.toLowerCase();
    const surpriseTokens = ["unexpected", "record", "highest", "lowest", "sharp", "material", "guidance", "beat", "miss"];

    const base = surpriseTokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
    const eventBoost = ["earnings", "buyback", "regulatory"].includes(classification.event_type) ? 2 : 0;
    const confidenceBoost = Math.round((Number(classification.confidence || 0) - 5) / 2);

    const surprise_score = Math.max(0, Math.min(10, base + eventBoost + Math.max(0, confidenceBoost) + 3));

    return {
      is_surprise: surprise_score >= DEFAULT_SURPRISE_TRADE_THRESHOLD,
      surprise_score,
      trade_threshold: DEFAULT_SURPRISE_TRADE_THRESHOLD,
    };
  } catch {
    return {
      is_surprise: false,
      surprise_score: 0,
      trade_threshold: DEFAULT_SURPRISE_TRADE_THRESHOLD,
    };
  }
}
