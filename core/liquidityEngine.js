const REL_VOL_THRESHOLD = Number(process.env.RELATIVE_VOLUME_THRESHOLD || 1.2);
const ATR_EXPANSION_THRESHOLD = Number(process.env.ATR_EXPANSION_THRESHOLD || 1.05);

export function confirmLiquidity({ metrics = {}, event_type = "other" } = {}) {
  try {
    const relativeVolume = Number(metrics.relativeVolume || process.env.DEFAULT_RELATIVE_VOLUME || 1.4);
    const atrExpansion = Number(metrics.atrExpansion || process.env.DEFAULT_ATR_EXPANSION || 1.1);
    const breakout = Boolean(metrics.breakout ?? true);

    const stricterForOther = event_type === "other" ? 0.1 : 0;
    const confirm_liquidity =
      relativeVolume >= REL_VOL_THRESHOLD + stricterForOther &&
      atrExpansion >= ATR_EXPANSION_THRESHOLD &&
      breakout;

    return {
      confirm_liquidity,
      metrics: { relativeVolume, atrExpansion, breakout },
    };
  } catch {
    return {
      confirm_liquidity: false,
      metrics: { relativeVolume: 0, atrExpansion: 0, breakout: false },
    };
  }
}
