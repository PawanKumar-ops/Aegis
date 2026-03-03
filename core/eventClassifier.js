import { safeText } from "@/utils/validators";

const EVENT_RULES = [
  { event_type: "earnings", keywords: ["earnings", "results", "q1", "q2", "q3", "q4", "net profit", "revenue"] },
  { event_type: "dividend", keywords: ["dividend", "interim dividend", "final dividend"] },
  { event_type: "buyback", keywords: ["buyback", "buy-back", "repurchase"] },
  { event_type: "promoter_change", keywords: ["promoter", "stake sale", "stake purchase", "pledge", "insider"] },
  { event_type: "regulatory", keywords: ["sebi", "penalty", "compliance", "approval", "order", "regulatory"] },
  { event_type: "macro", keywords: ["repo rate", "inflation", "gdp", "iip", "cpi", "policy"] },
];

function scoreDirection(text) {
  const positive = ["up", "growth", "beats", "record", "win", "approval", "increase", "surge"];
  const negative = ["down", "miss", "decline", "fall", "penalty", "fraud", "cut", "drop"];

  const plus = positive.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
  const minus = negative.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);

  if (plus > minus) return { direction: "bullish", confidence: Math.min(9, 5 + plus) };
  if (minus > plus) return { direction: "bearish", confidence: Math.min(9, 5 + minus) };
  return { direction: "neutral", confidence: 6 };
}

export function classifyEvent(event = {}) {
  try {
    const title = safeText(event.title).toLowerCase();
    const description = safeText(event.description).toLowerCase();
    const corpus = `${title} ${description}`.trim();

    const match = EVENT_RULES.find((rule) => rule.keywords.some((keyword) => corpus.includes(keyword)));
    const { direction, confidence } = scoreDirection(corpus);

    return {
      event_type: match?.event_type || "other",
      direction,
      confidence,
    };
  } catch {
    return {
      event_type: "other",
      direction: "neutral",
      confidence: 0,
    };
  }
}
