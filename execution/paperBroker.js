export async function simulatePaperTrade({ symbol, direction, entry_price, stop_price, quantity } = {}) {
  try {
    const normalizedDirection = direction === "bearish" ? "SELL" : "BUY";
    const entryPrice = Number(entry_price || 0);
    const stopPrice = Number(stop_price || 0);

    const targetPrice =
      normalizedDirection === "BUY"
        ? Number((entryPrice + Math.abs(entryPrice - stopPrice) * 1.5).toFixed(2))
        : Number((entryPrice - Math.abs(entryPrice - stopPrice) * 1.5).toFixed(2));

    return {
      ok: true,
      trade: {
        broker: "paper",
        order_id: `paper_${Date.now()}`,
        symbol,
        side: normalizedDirection,
        quantity: Number(quantity || 0),
        entry_price: entryPrice,
        stop_price: stopPrice,
        target_price: targetPrice,
        status: "SIMULATED_OPEN",
        executed_at: new Date().toISOString(),
      },
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      trade: null,
      error: {
        code: "PAPER_BROKER_ERROR",
        message: error?.message || "paper execution failed",
      },
    };
  }
}
