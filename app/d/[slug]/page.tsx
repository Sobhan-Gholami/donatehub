"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const currencyOptions: Record<string, string[]> = {
  forex: ["USD", "EUR"],
  crypto: ["USDT"],
};

export default function DonatePage() {
  return (
    <Suspense fallback={<main className="flex-1 flex items-center justify-center">در حال بارگذاری...</main>}>
      <DonatePageInner />
    </Suspense>
  );
}

function DonatePageInner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const [streamer, setStreamer] = useState<any>(null);
  const [method, setMethod] = useState<"toman" | "forex" | "crypto">("toman");
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [message, setMessage] = useState("");
  const [coverFee, setCoverFee] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/donate/${slug}`).then(async (r) => {
      if (r.ok) setStreamer((await r.json()).streamer);
    });
  }, [slug]);

  if (!streamer) return <main className="flex-1 flex items-center justify-center">در حال بارگذاری...</main>;

  const progress = streamer.goal_amount_toman > 0
    ? Math.min(100, (streamer.goal_current_toman / streamer.goal_amount_toman) * 100) : 0;

  const [showConfirm, setShowConfirm] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!donorName || !amount || Number(amount) <= 0) {
      setError("نام و مبلغ را وارد کنید");
      return;
    }
    setShowConfirm(true);
  }

  async function confirmSubmit() {
    setShowConfirm(false);
    setLoading(true);
    const res = await fetch(`/api/donate/${slug}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donor_name: donorName, donor_phone: donorPhone, donor_message: message,
        method, currency: method === "toman" ? "IRT" : currency, amount: Number(amount),
        cover_fee: method === "toman" ? coverFee : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || "خطا رخ داد");

    if (method === "toman" && data.redirect_url) {
      window.location.href = data.redirect_url;
    } else if (data.destination) {
      setDestination(data.destination);
    }
  }

  return (
    <main className="flex-1 max-w-lg mx-auto w-full p-4 md:p-8 flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        {streamer.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={streamer.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
        )}
        <h1 className="text-2xl font-bold">{streamer.display_name}</h1>
        {streamer.bio && <p className="text-muted text-sm">{streamer.bio}</p>}
      </div>

      {streamer.goal_title && (
        <div className="panel p-4">
          <div className="flex justify-between text-sm mb-2">
            <span>{streamer.goal_title}</span>
            <span className="text-muted amount">
              {streamer.goal_current_toman?.toLocaleString()} / {streamer.goal_amount_toman?.toLocaleString()} تومان
            </span>
          </div>
          <div className="h-3 progress-track">
            <div className="h-full progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {status === "success" && <div className="bg-green-950/50 text-green-400 rounded-lg p-3 text-sm text-center">پرداخت با موفقیت انجام شد 🎉</div>}
      {(status === "failed" || status === "cancelled") && <div className="bg-red-950/50 text-red-400 rounded-lg p-3 text-sm text-center">پرداخت ناموفق بود یا لغو شد</div>}

      {destination ? (
        <div className="panel p-4 flex flex-col gap-3">
          <div className="text-green-400 text-sm">ثبت شد ✅ لطفاً مبلغ را به آدرس زیر واریز کنید:</div>
          {destination.type === "card" && (
            <div className="field rounded-lg p-3 text-sm flex flex-col gap-1">
              <div>شماره کارت: <span className="font-mono">{destination.value}</span></div>
              {destination.owner_name && <div className="text-muted text-xs">به نام: {destination.owner_name}</div>}
            </div>
          )}
          {destination.type === "paypal" && (
            <div className="field rounded-lg p-3 text-sm break-all">ایمیل پی‌پال: {destination.value || "در حال حاضر در دسترس نیست، بعداً مراجعه کنید"}</div>
          )}
          {destination.type === "usdt" && (
            <div className="field rounded-lg p-3 text-sm break-all">
              آدرس ولت USDT ({destination.network}): {destination.value || "در حال حاضر در دسترس نیست"}
            </div>
          )}
          <div className="text-xs text-muted-dim">
            {method === "toman"
              ? "پس از واریز، تراکنش شما توسط استریمر بررسی و تایید می‌شود. نیازی به کار دیگری از سمت شما نیست."
              : "پس از واریز، تراکنش شما بررسی و ظرف ۲۴ ساعت برای استریمر نهایی می‌شود. نیازی به کار دیگری از سمت شما نیست."}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="panel p-4 flex flex-col gap-3">
          {error && <div className="text-red-400 text-sm bg-red-950/50 rounded p-2">{error}</div>}

          <div className="flex gap-2">
            {(["toman", "forex", "crypto"] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => { setMethod(m); setCurrency(m === "forex" ? "USD" : "USDT"); }}
                data-active={method === m}
                className={`chip flex-1 py-2 text-sm ${m === "toman" && !streamer.has_toman ? "opacity-40" : ""}`}
                disabled={m === "toman" && !streamer.has_toman}
              >
                {m === "toman" ? "تومنی" : m === "forex" ? "ارزی" : "رمزارزی"}
              </button>
            ))}
          </div>

          {method !== "toman" && (
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field px-3 py-2 text-sm">
              {currencyOptions[method].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <input
            className="field px-4 py-2.5"
            placeholder="نام شما"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
          />
          <input
            className="field px-4 py-2.5"
            placeholder="شماره تلفن (اختیاری)"
            value={donorPhone}
            onChange={(e) => setDonorPhone(e.target.value)}
          />
          <input
            type="number"
            className="field px-4 py-2.5"
            placeholder={method === "toman" ? "مبلغ (تومان)" : `مبلغ (${currency})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {method === "toman" && (
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input type="checkbox" checked={coverFee} onChange={(e) => setCoverFee(e.target.checked)} />
              <span>
                کارمزد درگاه (۰.۵٪) رو من پرداخت می‌کنم تا استریمر کامل {Number(amount || 0).toLocaleString()} تومان رو دریافت کنه
                {Number(amount) > 0 && (
                  <> — مبلغ نهایی: {Math.round(Number(amount) + Math.min(Number(amount) * 0.005, 3000)).toLocaleString()} تومان</>
                )}
              </span>
            </label>
          )}
          <textarea
            className="field px-4 py-2.5"
            placeholder="پیام (اختیاری)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button disabled={loading} className="btn-primary py-2.5 disabled:opacity-50">
            {loading ? "..." : "دونیت کن"}
          </button>
        </form>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} className="panel p-5 w-full max-w-sm flex flex-col gap-3">
            <h2 className="font-bold text-lg">تایید نهایی دونیت</h2>
            <p className="text-sm leading-7">
              شما می‌خواید مبلغ <span className="amount text-gold font-bold">{Number(amount).toLocaleString()} {method === "toman" ? "تومان" : currency}</span> به
              {" "}<span className="font-bold">{streamer.display_name}</span> (شناسه: {slug}) دونیت کنید.
            </p>
            {method === "toman" && coverFee && (
              <p className="text-xs text-muted-dim">
                با احتساب کارمزد درگاه، مبلغ نهایی از کارت شما: {Math.round(Number(amount) + Math.min(Number(amount) * 0.005, 3000)).toLocaleString()} تومان
              </p>
            )}
            <p className="text-xs text-signal">این مبلغ پس از پرداخت قابل برگشت نیست.</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 btn-secondary py-2.5">انصراف</button>
              <button onClick={confirmSubmit} disabled={loading} className="flex-1 btn-primary py-2.5 disabled:opacity-50">
                {loading ? "..." : "با پرداخت موافقم"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
