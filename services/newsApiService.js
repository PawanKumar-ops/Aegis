import { fetchWithTimeout } from "@/utils/timeout";
import { safeText, toIsoTime } from "@/utils/validators";

export async function fetchNewsApiHeadlines() {
  const apiKey = safeText(process.env.NEWS_API_KEY);
  if (!apiKey) {
    return {
      ok: true,
      items: [],
      error: { code: "NEWSAPI_DISABLED", message: "NEWS_API_KEY not configured. Skipping fallback." },
    };
  }

  try {
    const endpoint = new URL("https://newsapi.org/v2/top-headlines");
    endpoint.searchParams.set("country", "in");
    endpoint.searchParams.set("category", "business");
    endpoint.searchParams.set("pageSize", "5");

    const result = await fetchWithTimeout(endpoint.toString(), {
      headers: { "X-Api-Key": apiKey },
    });

    if (!result?.ok) return { ok: false, items: [], error: result.error };

    const data = await result.response.json();
    const items = (data?.articles || []).map((article) => ({
      source: "newsapi",
      type: "tier1_news",
      symbol: "NIFTY",
      title: safeText(article?.title) || "Untitled market story",
      description: safeText(article?.description) || "No description available.",
      time: toIsoTime(article?.publishedAt),
    }));

    return { ok: true, items, error: null };
  } catch (error) {
    return { ok: false, items: [], error: { code: "NEWSAPI_ERROR", message: error?.message || "NewsAPI request failed." } };
  }
}
