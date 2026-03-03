const DEFAULT_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

export async function withTimeout(taskFn, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort("Request timed out"), timeoutMs);

  try {
    return await taskFn(controller.signal);
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        ok: false,
        error: { code: "TIMEOUT", message: `Request exceeded ${timeoutMs}ms timeout.` },
      };
    }

    return {
      ok: false,
      error: {
        code: "REQUEST_FAILED",
        message: error?.message || "Request failed unexpectedly.",
      },
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return withTimeout(async (signal) => {
    const response = await fetch(url, {
      ...options,
      signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      return {
        ok: false,
        error: {
          code: "HTTP_ERROR",
          message: `HTTP ${response.status} for ${url}`,
          details: raw.slice(0, 500),
        },
      };
    }

    return { ok: true, response };
  }, timeoutMs);
}
