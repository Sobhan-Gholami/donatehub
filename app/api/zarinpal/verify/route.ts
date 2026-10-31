import { NextRequest, NextResponse } from "next/server";
import { baseUrl } from "@/lib/oauth";
import db from "@/lib/db";
import dns from "node:dns";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { creditTomanToStreamer } from "@/lib/donationCredit";

dns.setDefaultResultOrder("ipv4first");

const ZARINPAL_SANDBOX = process.env.ZARINPAL_SANDBOX === "true";
const ZARINPAL_VERIFY_URL = ZARINPAL_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
  : "https://api.zarinpal.com/pg/v4/payment/verify.json";
const SANDBOX_TEST_MERCHANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const donationId = searchParams.get("donation_id");
  const authority = searchParams.get("Authority");
  const status = searchParams.get("Status");

  const donation = db.prepare("SELECT * FROM donations WHERE id = ?").get(donationId) as any;
  if (!donation) return NextResponse.redirect(new URL("/", baseUrl(req)));

  const streamer = db.prepare("SELECT * FROM streamers WHERE id = ?").get(donation.streamer_id) as any;

  if (status !== "OK") {
    db.prepare("UPDATE donations SET status = 'failed' WHERE id = ?").run(donationId);
    db.prepare("INSERT INTO transaction_logs (donation_id, event, detail, actor) VALUES (?,?,?,?)")
      .run(donationId, "failed", "کاربر پرداخت را لغو کرد", "system");
    return NextResponse.redirect(new URL(`/d/${streamer.slug}?status=cancelled`, baseUrl(req)));
  }

  try {
    const zpRes = await fetchWithRetry(ZARINPAL_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: ZARINPAL_SANDBOX ? SANDBOX_TEST_MERCHANT_ID : streamer.zarinpal_merchant_id,
        amount: Math.round(donation.charged_amount || donation.amount),
        currency: "IRT",
        authority,
      }),
    });
    const zpData = await zpRes.json();

    // Codes 100 (fresh) and 101 (already verified) both mean success
    if (zpData?.data?.code === 100 || zpData?.data?.code === 101) {
      const refId = zpData.data.ref_id;
      const cardPan = zpData.data.card_pan || null;
      db.prepare(`
        UPDATE donations SET status = 'settled', zarinpal_ref_id = ?, card_number = ?,
          paid_at = CURRENT_TIMESTAMP, settled_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(refId, cardPan, donationId);
      // Fully automatic: no admin step needed, goal progress updates immediately.
      creditTomanToStreamer(donation.streamer_id, donation.amount);
      db.prepare("INSERT INTO transaction_logs (donation_id, event, detail, actor) VALUES (?,?,?,?)")
        .run(donationId, "settled", `پرداخت موفق - کد پیگیری ${refId}`, "system");
      return NextResponse.redirect(new URL(`/d/${streamer.slug}?status=success`, baseUrl(req)));
    } else {
      db.prepare("UPDATE donations SET status = 'failed' WHERE id = ?").run(donationId);
      db.prepare("INSERT INTO transaction_logs (donation_id, event, detail, actor) VALUES (?,?,?,?)")
        .run(donationId, "failed", "تایید درگاه ناموفق بود", "system");
      return NextResponse.redirect(new URL(`/d/${streamer.slug}?status=failed`, baseUrl(req)));
    }
  } catch {
    db.prepare("UPDATE donations SET status = 'failed' WHERE id = ?").run(donationId);
    return NextResponse.redirect(new URL(`/d/${streamer.slug}?status=failed`, baseUrl(req)));
  }
}
