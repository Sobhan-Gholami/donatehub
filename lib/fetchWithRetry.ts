// Some Windows machines / ISPs occasionally drop the connection mid TLS
// handshake to certain hosts (e.g. "Client network socket disconnected
// before secure TLS connection was established"). This is almost always
// transient, so retry a couple of times with a short backoff before giving
// up and surfacing an error to the user.
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempts = 3,
  delayMs = 800
): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, options);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e?.cause?.message || "");
      const transient =
        msg.includes("fetch failed") ||
        msg.includes("ECONNRESET") ||
        msg.includes("socket disconnected") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("EPIPE");
      if (!transient || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
