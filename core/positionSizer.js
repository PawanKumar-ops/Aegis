const DEFAULT_RISK_PER_TRADE_PCT = Number(process.env.RISK_PER_TRADE_PCT || 1);
const DEFAULT_ATR = Number(process.env.DEFAULT_ATR || 10);
const DEFAULT_ATR_MULTIPLIER = Number(process.env.ATR_MULTIPLIER || 2);

export function calculatePositionSize({ capital, entry_price, direction = "bullish" } = {}) {
  try {
    const accountCapital = Number(capital || process.env.TRADING_CAPITAL || 0);
    const entry = Number(entry_price || process.env.DEFAULT_ENTRY_PRICE || 0);

    if (accountCapital <= 0 || entry <= 0) {
      return {
        stop_price: 0,
        quantity: 0,
        risk_amount: 0,
        error: "invalid capital or entry price",
      };
    }

    const risk_amount = Number((accountCapital * (DEFAULT_RISK_PER_TRADE_PCT / 100)).toFixed(2));
    const stopDistance = Math.max(0.01, DEFAULT_ATR * DEFAULT_ATR_MULTIPLIER);

    const stop_price =
      direction === "bearish"
        ? Number((entry + stopDistance).toFixed(2))
        : Number((entry - stopDistance).toFixed(2));

    const quantity = Math.max(0, Math.floor(risk_amount / stopDistance));

    return {
      stop_price,
      quantity,
      risk_amount,
    };
  } catch {
    return {
      stop_price: 0,
      quantity: 0,
      risk_amount: 0,
      error: "position sizing failed",
    };
  }
}
