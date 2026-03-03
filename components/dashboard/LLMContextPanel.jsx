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

const ContextCard = ({ title, icon, panelData, providerPayload }) => {
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
          <span className="text-xs text-muted-foreground block mb-1">Model Response</span>
          <pre className="rounded border border-border bg-muted p-2 text-[11px] overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(providerPayload || null, null, 2)}
          </pre>
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

  const averageConfidence = (((openAiData.confidence + geminiData.confidence) / 2) * 100).toFixed(0);
  const tradable = Number(averageConfidence) >= 70;

  const combinedFeed = llmResponse?.fetched_news?.combined_feed || [];
  const nseFeed = llmResponse?.fetched_news?.nse_announcements || [];

  return (
    <>
      <ContextCard
        title="OpenAI Context & Market Regime"
        panelData={openAiData}
        providerPayload={openAiPayload}
        icon={<Brain className="h-4 w-4 text-foreground/80" />}
      />

      <ContextCard
        title="Gemini Context & Market Regime"
        panelData={geminiData}
        providerPayload={geminiPayload}
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
            <p className="text-xs text-muted-foreground mb-2">Combined Feed</p>
            {combinedFeed.length ? (
              combinedFeed.slice(0, 10).map((item, index) => (
                <div key={`${item.symbol}-${item.time}-${index}`} className="mb-2">
                  <div className="font-semibold text-xs">[{item.type}] {item.symbol}</div>
                  <div className="text-xs">{item.title}</div>
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
