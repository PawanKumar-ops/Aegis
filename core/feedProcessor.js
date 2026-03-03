import { safeText, toIsoTime } from "@/utils/validators";

const DEFAULT_LIMIT = Number(process.env.FEED_LIMIT || 10);

function headlineKey(title) {
  return safeText(title).toLowerCase().replace(/\s+/g, " ");
}

export function normalizeFeedItems(rawItems = []) {
  return rawItems.map((item) => ({
    source: safeText(item.source) || "unknown",
    type: safeText(item.type) || "news",
    symbol: safeText(item.symbol) || "UNKNOWN",
    title: safeText(item.title) || "Untitled",
    description: safeText(item.description) || "No description available.",
    url: safeText(item.url),
    time: toIsoTime(item.time),
  }));
}

export function dedupeByHeadline(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = headlineKey(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function processFeed(rawItems = [], limit = DEFAULT_LIMIT) {
  const normalized = normalizeFeedItems(rawItems);
  const deduped = dedupeByHeadline(normalized);
  const sorted = deduped.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  return sorted.slice(0, limit);
}

export function buildFeedSummary(feed = []) {
  if (!feed.length) return "No events available.";

  return feed
    .map(
      (item, index) =>
        `${index + 1}. [${item.type}] ${item.symbol} | ${item.time} | ${item.title}${item.description ? ` - ${item.description}` : ""}`
    )
    .join("\n");
}
