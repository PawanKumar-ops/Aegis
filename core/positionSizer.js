const DEFAULT_RISK_PER_TRADE_PCT = Number(process.env.RISK_PER_TRADE_PCT || 1);
const DEFAULT_ATR_MULTIPLIER = Number(process.env.ATR_MULTIPLIER || 2);
const DEFAULT_ATR = Number(process.env.DEFAULT_ATR || 10);

function estimateStopDistance() {
  return DEFAULT_ATR * DEFAULT_ATR_MULTIPLIER;
}

export function calculatePositionSize({ capital, entryPrice }) {
  try {
    const accountCapital = Number(capital || process.env.TRADING_CAPITAL || 0);
    const price = Number(entryPrice || 0);

    if (!accountCapital || !price) {
      return {
        ok: false,
        error: { code: "INVALID_CAPITAL_OR_PRICE", message: "capital and entryPrice are required." },
      };
    }

    const riskAmount = accountCapital * (DEFAULT_RISK_PER_TRADE_PCT / 100);
    const stopDistance = estimateStopDistance();
    const quantity = Math.max(0, Math.floor(riskAmount / stopDistance));

    return {
      ok: true,
      data: {
        riskAmount,
        stopDistance,
        quantity,
        stopLoss: Math.max(0, price - stopDistance),
      },
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      error: { code: "POSITION_SIZE_ERROR", message: error?.message || "Position size computation failed." },
    };
  }
}
