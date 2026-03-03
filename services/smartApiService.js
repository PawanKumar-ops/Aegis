import { fetchWithTimeout } from "@/utils/timeout";

const SMART_API_BASE = "https://apiconnect.angelone.in";

const REQUIRED_ENV_KEYS = [
  "SMARTAPI_API_KEY",
  "SMARTAPI_CLIENT_CODE",
  "SMARTAPI_PASSWORD",
  "SMARTAPI_TOTP",
  "SMARTAPI_INDEX_SYMBOL_TOKEN",
  "SMARTAPI_INDEX_TRADING_SYMBOL",
];

function hasRequiredConfig() {
  return REQUIRED_ENV_KEYS.every((key) => Boolean(process.env[key]));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildHeaders(jwtToken = "") {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-PrivateKey": process.env.SMARTAPI_API_KEY || "",
    ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
  };
}

async function smartApiPost(path, payload = {}, jwtToken = "") {
  const response = await fetchWithTimeout(`${SMART_API_BASE}${path}`, {
    method: "POST",
    headers: buildHeaders(jwtToken),
    body: JSON.stringify(payload),
  });

  if (!response?.ok) {
    return { ok: false, data: null, error: response.error };
  }

  const json = await response.response.json().catch(() => null);

  if (!json || json.status === false) {
    return {
      ok: false,
      data: null,
      error: {
        code: "SMARTAPI_RESPONSE_ERROR",
        message: json?.message || json?.errorcode || "SmartAPI request failed.",
      },
    };
  }

  return { ok: true, data: json.data || null, error: null };
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function buildHistoryWindow(days = 40) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  return {
    fromdate: formatDate(from),
    todate: formatDate(to),
  };
}

function normalizeCandle(candle = []) {
  if (!Array.isArray(candle) || candle.length < 5) return null;

  return {
    time: candle[0],
    open: toNumber(candle[1]),
    high: toNumber(candle[2]),
    low: toNumber(candle[3]),
    close: toNumber(candle[4]),
  };
}

function computeAtr14(candles = []) {
  if (!Array.isArray(candles) || candles.length < 15) return null;

  const normalized = candles.map(normalizeCandle).filter(Boolean);
  if (normalized.length < 15) return null;

  const trueRanges = [];

  for (let i = 1; i < normalized.length; i += 1) {
    const current = normalized[i];
    const prev = normalized[i - 1];

    if ([current.high, current.low, prev.close].some((x) => x === null)) continue;

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );

    trueRanges.push(tr);
  }

  if (trueRanges.length < 14) return null;

  const last14 = trueRanges.slice(-14);
  const atr = last14.reduce((sum, tr) => sum + tr, 0) / last14.length;

  return Number.isFinite(atr) ? Number(atr.toFixed(4)) : null;
}

function extractLatestOhlc(candles = []) {
  const normalized = candles.map(normalizeCandle).filter(Boolean);
  if (!normalized.length) return null;
  return normalized[normalized.length - 1];
}

async function createSession() {
  return smartApiPost("/rest/auth/angelbroking/user/v1/loginByPassword", {
    clientcode: process.env.SMARTAPI_CLIENT_CODE,
    password: process.env.SMARTAPI_PASSWORD,
    totp: process.env.SMARTAPI_TOTP,
  });
}

async function fetchDailyCandles({ jwtToken, symbolToken, tradingSymbol, exchange = "NSE" }) {
  const window = buildHistoryWindow(45);

  return smartApiPost(
    "/rest/secure/angelbroking/historical/v1/getCandleData",
    {
      exchange,
      symboltoken: symbolToken,
      interval: "ONE_DAY",
      fromdate: window.fromdate,
      todate: window.todate,
      tradingsymbol: tradingSymbol,
    },
    jwtToken
  );
}

export async function fetchSmartApiMarketData() {
  if (!hasRequiredConfig()) {
    return {
      ok: false,
      marketData: {},
      error: {
        code: "SMARTAPI_CONFIG_MISSING",
        message: "SmartAPI environment variables are missing.",
      },
    };
  }

  const session = await createSession();
  if (!session.ok || !session.data?.jwtToken) {
    return {
      ok: false,
      marketData: {},
      error: session.error || { code: "SMARTAPI_AUTH_FAILED", message: "Unable to authenticate with SmartAPI." },
    };
  }

  const jwtToken = session.data.jwtToken;

  const [indexHistory, vixHistory] = await Promise.all([
    fetchDailyCandles({
      jwtToken,
      symbolToken: process.env.SMARTAPI_INDEX_SYMBOL_TOKEN,
      tradingSymbol: process.env.SMARTAPI_INDEX_TRADING_SYMBOL,
      exchange: process.env.SMARTAPI_INDEX_EXCHANGE || "NSE",
    }),
    process.env.SMARTAPI_VIX_SYMBOL_TOKEN && process.env.SMARTAPI_VIX_TRADING_SYMBOL
      ? fetchDailyCandles({
          jwtToken,
          symbolToken: process.env.SMARTAPI_VIX_SYMBOL_TOKEN,
          tradingSymbol: process.env.SMARTAPI_VIX_TRADING_SYMBOL,
          exchange: process.env.SMARTAPI_VIX_EXCHANGE || "NSE",
        })
      : Promise.resolve({ ok: true, data: { candles: [] }, error: null }),
  ]);

  if (!indexHistory.ok) {
    return {
      ok: false,
      marketData: {},
      error: indexHistory.error || { code: "SMARTAPI_INDEX_FETCH_FAILED", message: "Unable to fetch index candles." },
    };
  }

  const indexCandles = Array.isArray(indexHistory.data?.candles) ? indexHistory.data.candles : [];
  const latestIndex = extractLatestOhlc(indexCandles);

  if (!latestIndex) {
    return {
      ok: false,
      marketData: {},
      error: { code: "SMARTAPI_NO_INDEX_DATA", message: "SmartAPI did not return index candle data." },
    };
  }

  const indexATR = computeAtr14(indexCandles);

  const vixCandles = Array.isArray(vixHistory.data?.candles) ? vixHistory.data.candles : [];
  const latestVix = extractLatestOhlc(vixCandles);

  return {
    ok: true,
    marketData: {
      indexOpen: latestIndex.open,
      indexHigh: latestIndex.high,
      indexLow: latestIndex.low,
      indexPrice: latestIndex.close,
      indexATR,
      indiaVix: latestVix?.close ?? null,
    },
    error: null,
  };
}
