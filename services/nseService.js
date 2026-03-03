import { fetchWithTimeout } from "@/utils/timeout";
import { safeText, toIsoTime } from "@/utils/validators";

const NSE_ENDPOINT =
  "https://www.nseindia.com/api/corporate-announcements?index=equities&from_date=&to_date=";

export async function fetchNseAnnouncements() {
  try {
    const result = await fetchWithTimeout(NSE_ENDPOINT, {
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.nseindia.com/companies-listing/corporate-filings-announcements",
        Origin: "https://www.nseindia.com",
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!result?.ok) return { ok: false, items: [], error: result.error };

    const payload = await result.response.json();
    const announcements = Array.isArray(payload) ? payload : payload?.data || [];

    const items = announcements.map((item) => ({
      source: "nse",
      type: "nse_announcement",
      symbol: safeText(item?.symbol) || "UNKNOWN",
      title: safeText(item?.sm_name || item?.subject || item?.headline) || "Untitled announcement",
      description:
        safeText(item?.desc || item?.attchmntText || item?.details || item?.subject) ||
        "No description available.",
      time: toIsoTime(item?.sort_date || item?.an_dt || item?.date || item?.broadcastdate),
    }));

    return { ok: true, items, error: null };
  } catch (error) {
    return {
      ok: false,
      items: [],
      error: { code: "NSE_FETCH_ERROR", message: error?.message || "NSE fetch failed." },
    };
  }
}
