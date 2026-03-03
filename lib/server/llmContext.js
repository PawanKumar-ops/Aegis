const DEFAULT_TIMEOUT_MS = 15_000;

const DEFAULT_RSS_URLS = [
  "https://www.moneycontrol.com/rss/business.xml",
  "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
  "https://www.livemint.com/rss/markets",
];

const NSE_ENDPOINT =
  "https://www.nseindia.com/api/corporate-announcements?index=equities&from_date=&to_date=";

const ANALYST_SYSTEM_PROMPT = [
  "You are a risk-aware Indian equities event analyst.",
  "Read the blended feed of official exchange announcements and Tier-1 market journalism.",
  "Return strictly JSON with keys: bias, confidence, reasoning.",
  "bias must be one of: Bullish, Bearish, Neutral.",
  "confidence must be a number between 0 and 10.",
  "reasoning must be a single concise sentence grounded in the supplied events.",
  "If the feed is sparse or conflicting, lower confidence and explain uncertainty.",
].join(" ");

const safeText = (value) => (typeof value === "string" ? value.trim() : "");

const parseDate = (value) => {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
};

const extractJsonObject = (text) => {
  const cleaned = safeText(text).replace(/```json\s*/gi, "").replace(/```/g, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
};

export const withTimeout = async (request, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Request timeout"), timeoutMs);

  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const fetchJson = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const response = await withTimeout(
    (signal) =>
      fetch(url, {
        ...options,
        signal,
        cache: "no-store",
      }),
    timeoutMs
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
};

const fetchText = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const response = await withTimeout(
    (signal) =>
      fetch(url, {
        ...options,
        signal,
        cache: "no-store",
      }),
    timeoutMs
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
};

const decodeXmlEntities = (value) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .trim();

const readTag = (input, tagName) => {
  const match = input.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXmlEntities(match[1]) : "";
};

const normalizeHeadline = (headline) => safeText(headline).toLowerCase().replace(/\s+/g, " ");

// Dedupes merged stories so repeated wire syndication or mirrored exchange text does not skew AI biasing.
export const dedupeByHeadline = (items) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = normalizeHeadline(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeAndLimitFeed = (items, limit = 10) =>
  dedupeByHeadline(items)
    .sort((a, b) => parseDate(b.time) - parseDate(a.time))
    .slice(0, limit);

const parseRssItems = (rssXml) => {
  const channelItems = Array.from(rssXml.matchAll(/<item\b[\s\S]*?<\/item>/gi));
  if (channelItems.length > 0) {
    return channelItems.map((match) => {
      const itemXml = match[0];
      return {
        title: readTag(itemXml, "title"),
        description: readTag(itemXml, "description"),
        pubDate: readTag(itemXml, "pubDate"),
      };
    });
  }

  const atomItems = Array.from(rssXml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi));
  return atomItems.map((match) => {
    const itemXml = match[0];
    return {
      title: readTag(itemXml, "title"),
      description: readTag(itemXml, "summary") || readTag(itemXml, "content"),
      pubDate: readTag(itemXml, "updated") || readTag(itemXml, "published"),
    };
  });
};

// Pull official NSE exchange disclosures so actions are grounded in primary-source filings.
export const fetchNSEAnnouncements = async () => {
  try {
    const payload = await fetchJson(NSE_ENDPOINT, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
        Origin: "https://www.nseindia.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    const announcements = Array.isArray(payload) ? payload : payload?.data || [];

    const normalized = announcements.map((item) => ({
      type: "nse_announcement",
      symbol: safeText(item?.symbol) || "UNKNOWN",
      title: safeText(item?.sm_name || item?.subject || item?.headline) || "Untitled announcement",
      description:
        safeText(item?.desc || item?.attchmntText || item?.details || item?.subject) ||
        "No description provided.",
      time:
        safeText(item?.sort_date || item?.an_dt || item?.date || item?.broadcastdate) ||
        new Date().toISOString(),
    }));

    return { items: normalized, error: null };
  } catch (error) {
    return { items: [], error: `NSE fetch failed: ${error.message}` };
  }
};

// Pull Tier-1 business media because exchange announcements alone miss context and narrative momentum.
export const fetchTier1News = async () => {
  const urls = safeText(process.env.NEWS_RSS_URLS)
    ? process.env.NEWS_RSS_URLS.split(",").map((url) => safeText(url)).filter(Boolean)
    : DEFAULT_RSS_URLS;

  const settled = await Promise.allSettled(
    urls.map((url) =>
      fetchText(url, {
        headers: {
          Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: "https://www.moneycontrol.com/",
        },
      })
    )
  );

  const errors = [];
  const items = [];

  settled.forEach((result, index) => {
    const source = urls[index];

    if (result.status === "rejected") {
      errors.push(`RSS fetch failed (${source}): ${result.reason?.message || "unknown error"}`);
      return;
    }

    const parsedItems = parseRssItems(result.value).map((entry) => ({
      type: "tier1_news",
      symbol: "NIFTY",
      title: entry.title || "Untitled market story",
      description: entry.description || "No description provided.",
      time: entry.pubDate || new Date().toISOString(),
    }));

    items.push(...parsedItems);
  });

  return { items, error: errors.length > 0 ? errors.join(" | ") : null };
};

const createAnalysisPrompt = (feedText) =>
  [
    "Analyze this Indian market event feed for short-horizon directional bias.",
    "Prioritize NSE disclosures over media headlines when conflicting.",
    "Return JSON only.",
    "Feed:",
    feedText || "No feed items available.",
  ].join("\n\n");

export const buildFeedSummary = (feed) =>
  feed
    .map(
      (item, idx) =>
        `${idx + 1}. [${item.type}] ${item.symbol} | ${item.time} | ${item.title}${item.description ? ` - ${item.description}` : ""
        }`
    )
    .join("\n");

const validateModelResult = (parsed) => {
  if (!parsed || typeof parsed !== "object") return null;

  const bias = safeText(parsed.bias);
  const confidence = Number(parsed.confidence);
  const reasoning = safeText(parsed.reasoning);

  if (!["Bullish", "Bearish", "Neutral"].includes(bias)) return null;
  if (Number.isNaN(confidence) || confidence < 0 || confidence > 10) return null;
  if (!reasoning) return null;

  return { bias, confidence, reasoning };
};

// OpenAI provides one inference view for event-driven bias and confidence scoring.
export const analyzeWithOpenAI = async (summaryText) => {
  const apiKey = safeText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return { analysis: null, raw: null, error: "OPENAI_API_KEY is missing." };
  }

  try {
    const model = safeText(process.env.OPENAI_MODEL) || "gpt-4o-mini";
    const body = {
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYST_SYSTEM_PROMPT },
        { role: "user", content: createAnalysisPrompt(summaryText) },
      ],
    };

    const response = await withTimeout((signal) =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      })
    );

    if (!response.ok) {
      const text = await response.text();
      return { analysis: null, raw: text, error: `OpenAI request failed (${response.status}).` };
    }

    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content || "";
    const parsed = validateModelResult(extractJsonObject(raw));

    return {
      analysis: parsed,
      raw,
      error: parsed ? null : "OpenAI returned non-conforming JSON analysis.",
    };
  } catch (error) {
    return { analysis: null, raw: null, error: `OpenAI error: ${error.message}` };
  }
};

// Gemini acts as an independent second model to reduce single-model bias risk.
export const analyzeWithGemini = async (summaryText) => {
  const apiKey = safeText(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return { analysis: null, raw: null, error: "GEMINI_API_KEY is missing." };
  }

  try {
    const model = safeText(process.env.GEMINI_MODEL) || "gemini-1.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${ANALYST_SYSTEM_PROMPT}\n\n${createAnalysisPrompt(summaryText)}` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const response = await withTimeout((signal) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      })
    );

    if (!response.ok) {
      const text = await response.text();
      return { analysis: null, raw: text, error: `Gemini request failed (${response.status}).` };
    }

    const payload = await response.json();
    const raw = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") || "";
    const parsed = validateModelResult(extractJsonObject(raw));

    return {
      analysis: parsed,
      raw,
      error: parsed ? null : "Gemini returned non-conforming JSON analysis.",
    };
  } catch (error) {
    return { analysis: null, raw: null, error: `Gemini error: ${error.message}` };
  }
};

// Optional premium aggregator, kept behind server-side NEWS_API_KEY and never exposed to clients.
export const fetchNewsApiHeadlines = async () => {
  const apiKey = safeText(process.env.NEWS_API_KEY);
  if (!apiKey) {
    return { items: [], error: "NEWS_API_KEY is missing; premium headlines skipped." };
  }

  try {
    const endpoint = new URL("https://newsapi.org/v2/top-headlines");
    endpoint.searchParams.set("country", "in");
    endpoint.searchParams.set("category", "business");
    endpoint.searchParams.set("pageSize", "5");

    const data = await fetchJson(endpoint, { headers: { "X-Api-Key": apiKey } });

    const items = (data?.articles || []).map((article) => ({
      type: "tier1_news",
      symbol: "NIFTY",
      title: safeText(article?.title) || "Untitled market story",
      description: safeText(article?.description) || "No description provided.",
      time: safeText(article?.publishedAt) || new Date().toISOString(),
    }));

    return { items, error: null };
  } catch (error) {
    return { items: [], error: `NewsAPI fetch failed: ${error.message}` };
  }
};
