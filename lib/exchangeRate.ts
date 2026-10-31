import { fetchWithRetry } from "@/lib/fetchWithRetry";

// We scrape AlanChand's public pages directly instead of using their API,
// since the free API tier is capped at 1 request/hour — too restrictive for
// live donation settlement. This is fragile against site redesigns; if a
// symbol stops resolving, check the page structure at the URLs below.

type RateResult = { rate_toman: number | null; raw?: string; error?: string };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
}

// Currency page lists rows like: "US Dollar 1,853,000 1,871,500 -"
// (Buy Price, Sell Price). We use the Buy Price — what we'd effectively get
// converting the donor's foreign currency into toman.
async function scrapeCurrencyRate(label: string): Promise<RateResult> {
  try {
    const res = await fetchWithRetry("https://alanchand.com/en/currencies-price", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return { rate_toman: null, error: `صفحه در دسترس نبود: ${res.status}` };
    const text = stripHtml(await res.text());

    const match = text.match(new RegExp(`${label}\\s+([\\d,]+)\\s+([\\d,]+)`));
    if (!match) return { rate_toman: null, raw: text.slice(0, 500), error: `مقدار '${label}' پیدا نشد` };

    const buyPrice = parseFloat(match[1].replace(/,/g, ""));
    return { rate_toman: buyPrice };
  } catch (e: any) {
    return { rate_toman: null, error: e?.message || "خطای ناشناخته" };
  }
}

async function scrapeUsdtRate(): Promise<RateResult> {
  try {
    const res = await fetchWithRetry("https://alanchand.com/en/crypto-price/usdt", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return { rate_toman: null, error: `صفحه در دسترس نبود: ${res.status}` };
    const text = stripHtml(await res.text());

    // Look for a Toman-denominated price near the word "Price" (avoids
    // accidentally grabbing the USD-denominated figure shown alongside it).
    const match = text.match(/Price[^0-9]{0,40}([\d,]{5,})\s*(?:Toman|IRR|تومان)/i)
      || text.match(/([\d,]{5,})\s*(?:Toman|تومان)/);
    if (!match) return { rate_toman: null, raw: text.slice(0, 500), error: "مقدار قیمت تتر پیدا نشد" };

    return { rate_toman: parseFloat(match[1].replace(/,/g, "")) };
  } catch (e: any) {
    return { rate_toman: null, error: e?.message || "خطای ناشناخته" };
  }
}

export async function getAlanchandRate(symbol: string): Promise<RateResult> {
  const s = symbol.toLowerCase();
  if (s === "usd") return scrapeCurrencyRate("US Dollar");
  if (s === "eur") return scrapeCurrencyRate("Euro");
  if (s === "usdt") return scrapeUsdtRate();
  return { rate_toman: null, error: "ارز پشتیبانی نمی‌شود" };
}

// Applies the streamer-protective margin (platform's default is -10%,
// meaning donors' forex/crypto gets converted at a rate 10% below the live
// market rate — same logic as an exchange office's buy price).
export function applyMargin(rateToman: number, marginPercent: number) {
  return rateToman * (1 - marginPercent / 100);
}
