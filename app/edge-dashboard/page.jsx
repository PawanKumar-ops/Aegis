"use client";

import { useEffect, useState } from "react";

const directionClass = {
  bullish: "text-green-600",
  bearish: "text-red-600",
  neutral: "text-gray-500",
};

function Card({ title, children }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

function Row({ label, value, className = "" }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${className}`}>{value ?? "-"}</span>
    </div>
  );
}

export default function EdgeDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/edge-engine", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.execution_result?.error?.message || json?.error?.message || "Failed to load edge pipeline data.");
        }
        setData(json);
      } catch (fetchError) {
        setError(fetchError?.message || "Failed to load edge pipeline data.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm">Loading edge pipeline...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Edge Engine Pipeline Dashboard</h1>

      <Card title="1 — Event Header">
        <Row label="Symbol" value={data?.symbol} />
        <Row label="Source Type" value={data?.source_type} />
        <Row label="News Title" value={data?.title} />
        <Row label="Description" value={data?.description} />
        <Row label="Timestamp" value={data?.timestamps?.processed_at || data?.timestamps?.requested_at} />
      </Card>

      <Card title="2 — LLM Analysis">
        <Row label="Event Type" value={data?.llm_summary?.event_type} />
        <Row
          label="Direction"
          value={data?.llm_summary?.direction}
          className={directionClass[data?.llm_summary?.direction] || directionClass.neutral}
        />
        <Row label="Materiality Score" value={data?.llm_summary?.materiality_score} />
        <Row label="Surprise Score" value={data?.llm_summary?.surprise_score} />
        <Row label="Impact Score" value={data?.llm_summary?.impact_score} />
        <Row label="Confidence" value={data?.llm_summary?.confidence} />
        <div>
          <p className="text-muted-foreground">Reasoning</p>
          <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{data?.llm_summary?.reasoning || "-"}</pre>
        </div>
      </Card>

      <Card title="3 — Liquidity Panel">
        <Row
          label="Confirm Liquidity"
          value={String(Boolean(data?.liquidity?.confirm_liquidity))}
          className={data?.liquidity?.confirm_liquidity ? "text-green-600" : "text-red-600"}
        />
        <Row label="Relative Volume" value={data?.liquidity?.metrics?.relativeVolume} />
        <Row label="ATR Expansion" value={data?.liquidity?.metrics?.atrExpansion} />
        <Row label="Breakout Status" value={String(Boolean(data?.liquidity?.metrics?.breakout))} />
      </Card>

      <Card title="4 — Market Regime">
        <Row label="Regime OK" value={String(Boolean(data?.regime?.regime_ok))} />
        <Row label="Index Trend Direction" value={data?.regime?.regime_details?.indexTrendDirection} />
        <Row label="Volatility State" value={data?.regime?.regime_details?.volatilityState} />
      </Card>

      <Card title="5 — Risk Decision">
        <Row
          label="Should Trade"
          value={String(Boolean(data?.risk?.should_trade))}
          className={data?.risk?.should_trade ? "text-green-600 text-base" : "text-red-600 text-base"}
        />
        <div>
          <p className="text-muted-foreground">Reasons if Rejected</p>
          <ul className="list-disc pl-5">
            {(data?.risk?.reasons_if_rejected || []).length ? (
              data.risk.reasons_if_rejected.map((reason) => <li key={reason}>{reason}</li>)
            ) : (
              <li>None</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-muted-foreground">Thresholds</p>
          <pre className="rounded bg-muted p-2 text-xs">{JSON.stringify(data?.risk?.thresholds || {}, null, 2)}</pre>
        </div>
      </Card>

      <Card title="6 — Position Sizing">
        <Row label="Stop Price" value={data?.position_sizing?.stop_price} />
        <Row label="Quantity" value={data?.position_sizing?.quantity} />
        <Row label="Risk Amount" value={data?.position_sizing?.risk_amount} />
      </Card>

      <Card title="7 — Execution Result">
        <Row
          label="Execution Status"
          value={data?.execution_result?.ok ? "Executed" : "Blocked"}
          className={data?.execution_result?.ok ? "text-green-600" : "text-red-600"}
        />
        <div>
          <p className="text-muted-foreground">Trade Object</p>
          <pre className="rounded bg-muted p-2 text-xs">{JSON.stringify(data?.execution_result?.trade || null, null, 2)}</pre>
        </div>
        <div>
          <p className="text-muted-foreground">Error Message</p>
          <pre className="rounded bg-muted p-2 text-xs">{JSON.stringify(data?.execution_result?.error || null, null, 2)}</pre>
        </div>
      </Card>

      <Card title="8 — Debug JSON (Collapsible)">
        <details>
          <summary className="cursor-pointer text-sm font-medium">Expand full pipeline JSON</summary>
          <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
        </details>
      </Card>
    </main>
  );
}
