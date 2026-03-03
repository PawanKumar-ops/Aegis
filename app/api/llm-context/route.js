import { NextResponse } from "next/server";

const ANALYST_PROMPT =
  'You are a financial analyst. Analyze the following company news and return ONLY JSON: 1. Bias: Bullish / Bearish / Neutral 2. Confidence score: 0–10 3. One-line reasoning News: "{{NEWS}}"';

const withTimeout = async (request, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const cleanJsonPayload = (text) => {
  if (!text) return null;
  const withoutFences = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const jsonSlice = withoutFences.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonSlice);
  } catch {
    return null;
  }
};

const fetchNews = async () => {
  try {
    const apiKey = process.env.NEWS_API_KEY || process.env.NEWSAPI_API_KEY;
    if (!apiKey) {
      return { articles: [], error: "NEWS_API_KEY (or NEWSAPI_API_KEY) is not configured." };
    }

    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", "stock market OR earnings OR company");
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", "6");

    const res = await withTimeout((signal) =>
      fetch(url, {
        headers: { "X-Api-Key": apiKey },
        cache: "no-store",
        signal,
      })
    );

    if (!res.ok) {
      return { articles: [], error: `NewsAPI request failed (${res.status}).` };
    }

    const data = await res.json();
    const articles = (data.articles || []).map((article, index) => ({
      id: `${index + 1}`,
      title: article.title || "Untitled",
      source: article.source?.name || "Unknown",
      description: article.description || "",
      url: article.url || "",
      publishedAt: article.publishedAt || "",
    }));

    console.log("[llm-context] fetched news", articles);
    return { articles, error: null };
  } catch (error) {
    return { articles: [], error: `NewsAPI error: ${error.message}` };
  }
};

const analyzeWithOpenAI = async (newsText) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { error: "OPENAI_API_KEY is not configured.", analysis: null };
    }

    const prompt = ANALYST_PROMPT.replace("{{NEWS}}", newsText);

    const res = await withTimeout((signal) =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
        signal,
      })
    );

    if (!res.ok) {
      return { error: `OpenAI request failed (${res.status}).`, analysis: null };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = cleanJsonPayload(content);

    console.log("[llm-context] openai analysis", parsed || content);

    return {
      error: parsed ? null : "OpenAI response did not contain valid JSON.",
      analysis: parsed,
      raw: content,
    };
  } catch (error) {
    return { error: `OpenAI error: ${error.message}`, analysis: null };
  }
};

const analyzeWithGemini = async (newsText) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return { error: "GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured.", analysis: null };
    }

    const prompt = ANALYST_PROMPT.replace("{{NEWS}}", newsText);
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await withTimeout((signal) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
        signal,
      })
    );

    if (!res.ok) {
      return { error: `Gemini request failed (${res.status}).`, analysis: null };
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
    const parsed = cleanJsonPayload(content);

    console.log("[llm-context] gemini analysis", parsed || content);

    return {
      error: parsed ? null : "Gemini response did not contain valid JSON.",
      analysis: parsed,
      raw: content,
    };
  } catch (error) {
    return { error: `Gemini error: ${error.message}`, analysis: null };
  }
};

export async function GET() {
  try {
    const { articles, error: newsError } = await fetchNews();

    const newsText = articles
      .map((a, idx) => `${idx + 1}. ${a.title}${a.description ? ` - ${a.description}` : ""}`)
      .join("\n");

    const [openai, gemini] = await Promise.all([
      analyzeWithOpenAI(newsText || "No news articles were returned."),
      analyzeWithGemini(newsText || "No news articles were returned."),
    ]);

    return NextResponse.json({
      news: articles,
      promptTemplate: ANALYST_PROMPT,
      openai,
      gemini,
      errors: [newsError, openai.error, gemini.error].filter(Boolean),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to build LLM context.", details: error.message },
      { status: 500 }
    );
  }
}
