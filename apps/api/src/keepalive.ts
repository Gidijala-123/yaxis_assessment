/**
 * Keep-alive ping — prevents Render free tier from spinning down.
 * Pings the /api/health endpoint every 14 minutes.
 * Only runs in production.
 */
export function startKeepAlive() {
  if (process.env.NODE_ENV !== "production") return;

  const selfUrl = process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/api/health`
    : null;

  if (!selfUrl) return;

  const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

  setInterval(async () => {
    try {
      await fetch(selfUrl);
      console.log(`[keep-alive] pinged ${selfUrl}`);
    } catch (e) {
      console.warn(`[keep-alive] ping failed: ${e}`);
    }
  }, INTERVAL_MS);

  console.log(`[keep-alive] started — pinging ${selfUrl} every 14 minutes`);
}
