export async function placePaperOrder(orderIntent) {
  try {
    const trade = {
      broker: "paper",
      status: "FILLED",
      orderId: `paper_${Date.now()}`,
      executedAt: new Date().toISOString(),
      ...orderIntent,
    };

    return { ok: true, trade, error: null };
  } catch (error) {
    return {
      ok: false,
      trade: null,
      error: { code: "PAPER_EXECUTION_ERROR", message: error?.message || "Paper execution failed." },
    };
  }
}
