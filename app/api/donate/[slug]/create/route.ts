import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import dns from "node:dns";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

// Safety net alongside instrumentation.ts: on some Windows setups Node tries
// IPv6 first and outbound HTTPS fetches silently fail even though the same
// host works fine in a browser.
dns.setDefaultResultOrder("ipv4first");

const ZARINPAL_SANDBOX = process.env.ZARINPAL_SANDBOX === "true";
const ZARINPAL_REQUEST_URL = ZARINPAL_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
  : "https://api.zarinpal.com/pg/v4/payment/request.json";
const ZARINPAL_STARTPAY_URL = ZARINPAL_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/StartPay/"
  : "https://www.zarinpal.com/pg/StartPay/";
// Zarinpal's official test merchant ID — always accepts payments in sandbox mode.
const SANDBOX_TEST_MERCHANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();
  const { donor_name, donor_phone, donor_message, method, currency, amount, cover_fee } = body;

  if (!donor_name || !method || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });
  }

  const streamer = db.prepare("SELECT * FROM streamers WHERE slug = ? AND is_active = 1").get(slug) as any;
  if (!streamer) return NextResponse.json({ error: "استریمر پیدا نشد" }, { status: 404 });

  if (method === "toman") {
    if (!ZARINPAL_SANDBOX && !streamer.zarinpal_merchant_id) {
      return NextResponse.json({ error: "این استریمر درگاه تومنی فعال ندارد" }, { status: 400 });
    }

    // Zarinpal's fee (currently 0.5%, capped at 3000 toman) is normally
    // deducted from the streamer's settlement. If the donor opts to cover
    // it, we charge slightly more so the streamer nets the full intended
    // amount — donations.amount stays the intended/credited amount either way.
    const intendedAmount = Math.round(Number(amount));
    const feeEstimate = Math.min(intendedAmount * 0.005, 3000);
    const chargedAmount = cover_fee ? Math.round(intendedAmount + feeEstimate) : intendedAmount;

    const info = db.prepare(`
      INSERT INTO donations (streamer_id, donor_name, donor_phone, donor_message, method, currency, amount, charged_amount, status)
      VALUES (?,?,?,?,?,?,?,?, 'pending')
    `).run(streamer.id, donor_name, donor_phone || null, donor_message || null, "toman", "IRT", intendedAmount, chargedAmount);
    const donationId = info.lastInsertRowid;

    try {
      const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin}/api/zarinpal/verify?donation_id=${donationId}`;
      const zpRes = await fetchWithRetry(ZARINPAL_REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: ZARINPAL_SANDBOX ? SANDBOX_TEST_MERCHANT_ID : streamer.zarinpal_merchant_id,
          amount: chargedAmount,
          currency: "IRT", // without this, Zarinpal defaults to Rial and charges 1/10th of the intended amount
          callback_url: callbackUrl,
          description: `دونیت برای ${streamer.display_name}`,
          metadata: { mobile: donor_phone || undefined },
        }),
      });
      const zpData = await zpRes.json();

      if (zpData?.data?.authority) {
        db.prepare("UPDATE donations SET zarinpal_authority = ? WHERE id = ?").run(zpData.data.authority, donationId);
        db.prepare("INSERT INTO transaction_logs (donation_id, event, detail, actor) VALUES (?,?,?,?)")
          .run(donationId, "created", "درخواست پرداخت درگاه ایجاد شد", "system");
        return NextResponse.json({
          ok: true,
          donation_id: donationId,
          redirect_url: `${ZARINPAL_STARTPAY_URL}${zpData.data.authority}`,
        });
      }

      // Zarinpal v4 returns errors as { data: [], errors: { code, message, validations } }
      console.error("Zarinpal request failed:", JSON.stringify(zpData));
      const reason = zpData?.errors?.message || zpData?.errors?.validations?.[0]?.message || "پاسخ نامعتبر از درگاه";
      return NextResponse.json({ error: `خطا در اتصال به درگاه پرداخت: ${reason}`, details: zpData }, { status: 502 });
    } catch (e: any) {
      console.error("Zarinpal request threw:", e, "cause:", e?.cause);
      const causeMsg = e?.cause?.message || e?.cause?.code || "";
      return NextResponse.json(
        { error: `خطا در اتصال به درگاه پرداخت: ${e?.message || "خطای ناشناخته"}${causeMsg ? " (" + causeMsg + ")" : ""}` },
        { status: 502 }
      );
    }
  }

  if (method === "forex" || method === "crypto") {
    if (!currency) return NextResponse.json({ error: "واحد پول را انتخاب کنید" }, { status: 400 });

    const platform = db.prepare("SELECT * FROM platform_settings WHERE id = 1").get() as any;
    const info = db.prepare(`
      INSERT INTO donations (streamer_id, donor_name, donor_phone, donor_message, method, currency, amount, status)
      VALUES (?,?,?,?,?,?,?, 'pending')
    `).run(streamer.id, donor_name, donor_phone || null, donor_message || null, method, currency, amount);
    db.prepare("INSERT INTO transaction_logs (donation_id, event, detail, actor) VALUES (?,?,?,?)")
      .run(info.lastInsertRowid, "created", "در انتظار واریز دونیتور", "system");

    // Only the raw account identifier is returned — never an owner/account name.
    const destination = method === "forex"
      ? { type: "paypal", value: platform?.forex_paypal_email || null }
      : { type: "usdt", network: platform?.crypto_network || "TRC20", value: platform?.crypto_usdt_address || null };

    return NextResponse.json({ ok: true, donation_id: info.lastInsertRowid, destination });
  }

  return NextResponse.json({ error: "روش نامعتبر" }, { status: 400 });
}
