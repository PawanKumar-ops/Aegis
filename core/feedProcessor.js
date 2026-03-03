import { safeText, toIsoTime } from "@/utils/validators";

/*
Expected marketData structure:

{
  indexOpen,
  indexHigh,
  indexLow,
  indexPrice,
  indexATR,     // ATR(14)
  indiaVix      // optional
}
*/

const DEFAULT_LIMIT = Number(process.env.FEED_LIMIT || 15);

// ===============================
// Volatility-Based MAX AGE Engine
// ===============================

function rangeBasedAge({ indexOpen, indexHigh, indexLow }) {
  if (!indexOpen || !indexHigh || !indexLow) return 90;

  const rangePercent =
    ((indexHigh - indexLow) / indexOpen) * 100;

  if (rangePercent > 1.5) return 45;
  if (rangePercent > 1.0) return 60;
  if (rangePercent > 0.6) return 90;
  return 120;
}

function atrBasedAge({ indexATR, indexPrice }) {
  if (!indexATR || !indexPrice) return 90;

  const atrPercent = (indexATR / indexPrice) * 100;

  if (atrPercent > 2) return 45;
  if (atrPercent > 1.5) return 60;
  if (atrPercent > 1) return 90;
  return 120;
}

function vixBasedAge(indiaVix) {
  if (!indiaVix) return 90;

  if (indiaVix > 20) return 45;
  if (indiaVix > 15) return 60;
  if (indiaVix > 12) return 90;
  return 120;
}

function sessionBasedAge() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Market timing approx (IST)
  const marketOpen = 9 * 60 + 15;
  const midMorning = 10 * 60 + 30;
  const afternoon = 14 * 60;

  if (totalMinutes < midMorning) return 60;      // fast reaction phase
  if (totalMinutes < afternoon) return 90;       // normal session
  return 45;                                      // late session stricter
}

function computeDynamicMaxAge(marketData = {}) {
  const rAge = rangeBasedAge(marketData);
  const aAge = atrBasedAge(marketData);
  const vAge = vixBasedAge(marketData.indiaVix);
  const sAge = sessionBasedAge();

  return Math.min(rAge, aAge, vAge, sAge);
}

// ===============================
// Feed Utilities
// ===============================

function normalizeString(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDedupKey(item) {
  return normalizeString(`${item.symbol}-${item.title}`);
}

function isRecent(time, maxAgeMinutes) {
  const now = Date.now();
  const eventTime = Date.parse(time);
  if (!eventTime) return false;

  const diffMinutes = (now - eventTime) / (1000 * 60);
  return diffMinutes <= maxAgeMinutes;
}

// ===============================
// Core Processing
// ===============================

export function normalizeFeedItems(rawItems = []) {
  return rawItems
    .map((item) => {
      const time = toIsoTime(item.time);

      return {
        source: safeText(item.source) || "unknown",
        type: safeText(item.type) || "news",
        symbol: safeText(item.symbol) || "UNKNOWN",
        title: safeText(item.title) || "Untitled",
        description: safeText(item.description) || "",
        url: safeText(item.url) || "",
        time,
        timestamp: Date.parse(time) || 0,
      };
    })
    .filter((item) => item.timestamp > 0);
}

export function dedupeFeed(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const key = buildDedupKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterRecent(items = [], maxAgeMinutes = 90) {
  return items.filter((item) =>
    isRecent(item.time, maxAgeMinutes)
  );
}

export function sortByLatest(items = []) {
  return [...items].sort((a, b) => b.timestamp - a.timestamp);
}

// ===============================
// Main Orchestrator
// ===============================

export function processFeed(
  rawItems = [],
  marketData = {},
  limit = DEFAULT_LIMIT
) {
  const dynamicMaxAge = computeDynamicMaxAge(marketData);

  const normalized = normalizeFeedItems(rawItems);
  const recent = filterRecent(normalized, dynamicMaxAge);
  const deduped = dedupeFeed(recent);
  const sorted = sortByLatest(deduped);

  return sorted.slice(0, limit);
}

// ===============================
// AI Prompt Builder
// ===============================

export function buildFeedSummary(feed = []) {
  if (!feed.length) return "No significant events available.";

  return feed
    .map(
      (item, index) =>
        `${index + 1}.
Source: ${item.source}
Type: ${item.type}
Symbol: ${item.symbol}
Time: ${item.time}
Headline: ${item.title}
Details: ${item.description || "N/A"}
`
    )
    .join("\n---------------------\n");
}