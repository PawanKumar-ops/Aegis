import { fetchWithTimeout } from "@/utils/timeout";
import { safeText, toIsoTime } from "@/utils/validators";

const DEFAULT_RSS_URLS = [
  "https://www.moneycontrol.com/rss/business.xml",
  "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
  "https://www.livemint.com/rss/markets",
];

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function readTag(input, tagName) {
  const match = input.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseRssItems(xml) {
  const rssItems = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi));
  if (rssItems.length) {
    return rssItems.map((entry) => ({
      title: readTag(entry[0], "title"),
      description: readTag(entry[0], "description"),
      link: readTag(entry[0], "link"),
      pubDate: readTag(entry[0], "pubDate"),
    }));
  }

  const atomItems = Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi));
  return atomItems.map((entry) => ({
    title: readTag(entry[0], "title"),
    description: readTag(entry[0], "summary") || readTag(entry[0], "content"),
    link:
      entry[0].match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ||
      readTag(entry[0], "id"),
    pubDate: readTag(entry[0], "updated") || readTag(entry[0], "published"),
  }));
}

export async function fetchTier1RssFeeds() {
  try {
    const urls = safeText(process.env.NEWS_RSS_URLS)
      ? process.env.NEWS_RSS_URLS.split(",").map((url) => safeText(url)).filter(Boolean)
      : DEFAULT_RSS_URLS;

    const settled = await Promise.allSettled(
      urls.map((url) =>
        fetchWithTimeout(url, {
          headers: {
            Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
            "User-Agent": "Mozilla/5.0",
          },
        })
      )
    );

    const items = [];
    const errors = [];

    for (let i = 0; i < settled.length; i += 1) {
      const source = urls[i];
      const result = settled[i];

      if (result.status === "rejected") {
        errors.push({ code: "RSS_FETCH_REJECTED", message: result.reason?.message || `Failed for ${source}` });
        continue;
      }

      if (!result.value?.ok) {
        errors.push(result.value?.error || { code: "RSS_FETCH_ERROR", message: `Failed for ${source}` });
        continue;
      }

      const xml = await result.value.response.text();
      const parsed = parseRssItems(xml);
      items.push(
        ...parsed.map((entry) => ({
          source,
          type: "tier1_news",
          symbol: "NIFTY",
          title: entry.title || "Untitled market story",
          description: entry.description || "No description available.",
          url: safeText(entry.link),
          time: toIsoTime(entry.pubDate),
        }))
      );
    }

    return {
      ok: true,
      items,
      error: errors.length ? { code: "RSS_PARTIAL_FAILURE", message: "Some RSS feeds failed.", details: errors } : null,
    };
  } catch (error) {
    return { ok: false, items: [], error: { code: "RSS_FATAL_ERROR", message: error?.message || "RSS fetch failed." } };
  }
}
