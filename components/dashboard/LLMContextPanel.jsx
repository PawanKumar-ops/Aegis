"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { llmContext } from "@/data/mockData";
import { Brain, TrendingUp, TrendingDown, Minus, HelpCircle, AlertTriangle } from "lucide-react";

const regimeConfig = {
  BULLISH: { icon: TrendingUp, color: "text-profit" },
  BEARISH: { icon: TrendingDown, color: "text-loss" },
  RANGE: { icon: Minus, color: "text-warning" },
  UNCLEAR: { icon: HelpCircle, color: "text-muted-foreground" },
};

const derivePanelData = (analysis) => {
  if (!analysis) return llmContext;

  const normalizedBias = (analysis.Bias || analysis.bias || "Neutral").toString();
  const confidenceScore = Number(analysis["Confidence score"] ?? analysis.confidence ?? 5);

  let regime = "RANGE";
  if (normalizedBias.toLowerCase() === "bullish") regime = "BULLISH";
  if (normalizedBias.toLowerCase() === "bearish") regime = "BEARISH";

  return {
    regime,
    bias: normalizedBias,
    confidence: Math.max(0, Math.min(confidenceScore / 10, 1)),
    newsSummary: analysis["One-line reasoning"] || analysis.reasoning || "Model did not provide a one-line reasoning.",
    timestamp: new Date().toLocaleString(),
  };
};

const deriveInstrumentMeta = (response) => {
  const symbol = response?.symbol || "NIFTY";
  const headline = response?.title || "No headline available";
  const isIndex = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX"].includes(String(symbol).toUpperCase());

  return {
    companyOrIndex: symbol,
    market: "NSE / Indian Equities",
    instrumentType: isIndex ? "Index" : "Company",
    headline,
  };
};

const ProviderDetail = ({ providerPayload }) => {
  const analysis = providerPayload?.analysis || null;

  return (
    <div className="rounded border border-border p-3 bg-muted/30 space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Provider Status</p>
          <p className={providerPayload?.ok ? "text-profit font-semibold" : "text-loss font-semibold"}>
            {providerPayload?.ok ? "Available" : "Unavailable"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Event Type</p>
          <p className="font-medium">{analysis?.event_type || "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Direction</p>
          <p className="font-medium capitalize">{analysis?.direction || "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Impact Score</p>
          <p className="font-medium">{analysis?.impact_score ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Materiality</p>
          <p className="font-medium">{analysis?.materiality_score ?? "-"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Surprise Score</p>
          <p className="font-medium">{analysis?.surprise_score ?? "-"}</p>
        </div>
      </div>

      {providerPayload?.error?.message && (
        <p className="text-xs text-loss">{providerPayload.error.message}</p>
      )}
    </div>
  );
};

const ContextCard = ({ title, icon, panelData, providerPayload, instrumentMeta }) => {
  const cfg = regimeConfig[panelData.regime] || regimeConfig.UNCLEAR;
  const Icon = cfg.icon;
  const isNoTradeZone = panelData.confidence < 0.6;

  return (
    <Card className="relative overflow-hidden">
      {isNoTradeZone && (
        <div className="absolute inset-0 bg-loss/10 border-2 border-loss/30 rounded-lg z-10 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-loss mx-auto mb-2" />
            <p className="text-loss font-bold text-lg font-mono-data">NO TRADE ZONE</p>
            <p className="text-loss/70 text-xs">Confidence below threshold</p>
          </div>
        </div>
      )}

      <CardHeader className="pb-3 p-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded border border-border p-3 bg-muted/20 text-xs">
          <div>
            <p className="text-muted-foreground">Company / Index</p>
            <p className="font-semibold">{instrumentMeta.companyOrIndex}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Market</p>
            <p className="font-semibold">{instrumentMeta.market}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Type</p>
            <p className="font-semibold">{instrumentMeta.instrumentType}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Regime</span>
          <div className="flex items-center gap-1.5">
            <Icon className={`h-4 w-4 ${cfg.color}`} />
            <Badge className={`${cfg.color} border-current/30 text-xs`} variant="outline">
              {panelData.regime}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Bias</span>
          <span className="text-sm font-mono-data">{panelData.bias}</span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <span className={`text-sm font-mono-data font-semibold ${panelData.confidence >= 0.6 ? "text-profit" : "text-loss"}`}>
              {(panelData.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <Progress
            value={panelData.confidence * 100}
            className={`h-2 ${panelData.confidence >= 0.6 ? "[&>div]:bg-success" : "[&>div]:bg-loss"}`}
          />
        </div>

        <div>
          <span className="text-xs text-muted-foreground block mb-1">News Summary</span>
          <p className="text-xs text-foreground/80 leading-relaxed">{panelData.newsSummary}</p>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block mb-1">Latest Headline</span>
          <p className="text-xs">{instrumentMeta.headline}</p>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block mb-1">Model Insights</span>
          <ProviderDetail providerPayload={providerPayload} />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground">Last Updated</span>
          <span className="text-xs font-mono-data text-muted-foreground">{panelData.timestamp}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export function LLMContextPanel() {
  const [llmResponse, setLlmResponse] = useState(null);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const res = await fetch("/api/llm-context", { cache: "no-store" });
        const data = await res.json();
        setLlmResponse(data);
      } catch {
        setLlmResponse({ ok: false, error: "Failed to load LLM context." });
      }
    };

    loadContext();
  }, []);

  const openAiPayload = llmResponse?.llm_summary?.model_meta?.provider_status?.openai || null;
  const geminiPayload = llmResponse?.llm_summary?.model_meta?.provider_status?.gemini || null;

  const openAiData = useMemo(() => derivePanelData(openAiPayload?.analysis), [openAiPayload]);
  const geminiData = useMemo(() => derivePanelData(geminiPayload?.analysis), [geminiPayload]);
  const instrumentMeta = useMemo(() => deriveInstrumentMeta(llmResponse), [llmResponse]);

  const averageConfidence = (((openAiData.confidence + geminiData.confidence) / 2) * 100).toFixed(0);
  const tradable = Number(averageConfidence) >= 70;

  const rssNews = llmResponse?.fetched_news?.rss_news || [];
  const nseFeed = llmResponse?.fetched_news?.nse_announcements || [];

  return (
    <>
      <ContextCard
        title="OpenAI Context & Market Regime"
        panelData={openAiData}
        providerPayload={openAiPayload}
        instrumentMeta={instrumentMeta}
        icon={<Brain className="h-4 w-4 text-foreground/80" />}
      />

      <ContextCard
        title="Gemini Context & Market Regime"
        panelData={geminiData}
        providerPayload={geminiPayload}
        instrumentMeta={instrumentMeta}
        icon={<Image src="/gemini.svg" alt="Gemini" width={16} height={16} />}
      />

      <Card className="p-4 space-y-2">
        <div className={tradable ? "text-green-500" : "text-loss"}>
          {tradable ? "Tradable - Average confidence ≥ 70%" : "No Trade Zone - Average confidence < 70%"}
        </div>
        <div>LLM Overall Confidence {averageConfidence}%</div>
      </Card>

      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-sm font-medium">Fetched News (NewsAPI + NSE)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">NSE Announcements</p>
            {nseFeed.length ? (
              nseFeed.slice(0, 8).map((item, index) => (
                <div key={`${item.symbol}-${item.time}-${index}`} className="mb-2">
                  <div className="font-semibold text-xs">[{item.type}] {item.symbol}</div>
                  <div className="text-xs">{item.title}</div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No NSE announcements returned.</p>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-2">RSS News</p>
            {rssNews.length ? (
              rssNews.slice(0, 10).map((item, index) => (
                <div key={`${item.symbol}-${item.time}-${index}`} className="mb-2">
                  <div className="font-semibold text-xs">[{item.type}] {item.symbol}</div>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline-offset-2 hover:underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <div className="text-xs">{item.title}</div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No news returned yet.</p>
            )}
          </div>

          {(llmResponse?.fetched_news?.source_errors || []).length > 0 && (
            <div className="text-xs text-loss">{llmResponse.fetched_news.source_errors.join(" | ")}</div>
          )}
          {llmResponse?.error && <div className="text-xs text-loss">{llmResponse.error}</div>}
        </CardContent>
      </Card>
    </>
  );
}
