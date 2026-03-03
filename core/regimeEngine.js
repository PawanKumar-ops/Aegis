const ALLOWED_TRENDS = ["up", "down", "sideways"];
const ALLOWED_VOL = ["low", "medium", "high"];

export function evaluateMarketRegime() {
  try {
    const indexTrendDirection = ALLOWED_TRENDS.includes(process.env.INDEX_TREND_DIRECTION)
      ? process.env.INDEX_TREND_DIRECTION
      : "up";
    const volatilityState = ALLOWED_VOL.includes(process.env.MARKET_VOLATILITY_STATE)
      ? process.env.MARKET_VOLATILITY_STATE
      : "medium";

    const regime_ok = indexTrendDirection !== "sideways" && volatilityState !== "high";

    return {
      regime_ok,
      regime_details: {
        indexTrendDirection,
        volatilityState,
      },
    };
  } catch {
    return {
      regime_ok: false,
      regime_details: {
        indexTrendDirection: "sideways",
        volatilityState: "high",
      },
    };
  }
}
