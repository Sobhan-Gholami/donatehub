"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const methodLabel: Record<string, string> = { toman: "تومنی", forex: "ارزی", crypto: "رمزارزی" };
const statusLabel: Record<string, string> = {
  pending: "در انتظار", confirmed: "تایید شده", settled: "تسویه شده", failed: "ناموفق", cancelled: "لغو شده",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"streamers" | "donations" | "settings">("streamers");
  const [streamers, setStreamers] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [filterMethod, setFilterMethod] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [settleTarget, setSettleTarget] = useState<any>(null);

  async function loadStreamers() {
    const res = await fetch("/api/admin/streamers");
    if (res.status === 401) return router.push("/admin/login");
    setStreamers((await res.json()).streamers || []);
  }
  async function loadDonations() {
    const q = new URLSearchParams();
    if (filterMethod) q.set("method", filterMethod);
    if (filterStatus) q.set("status", filterStatus);
    const res = await fetch(`/api/admin/donations?${q}`);
    setDonations((await res.json()).donations || []);
  }
  async function loadSettings() {
    const res = await fetch("/api/admin/settings");
    setSettings((await res.json()).settings || {});
  }

  useEffect(() => { loadStreamers(); }, []);
  useEffect(() => { if (tab === "donations") loadDonations(); }, [tab, filterMethod, filterStatus]);
  useEffect(() => { if (tab === "settings") loadSettings(); }, [tab]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    loadSettings();
  }

  async function doSettleAction(donation: any, action: "confirm" | "settle" | "fail", extra?: any) {
    await fetch(`/api/admin/donations/${donation.id}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setSettleTarget(null);
    loadDonations();
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="on-air-dot" />
          <h1 className="text-xl font-bold">پنل ادمین</h1>
        </div>
        <button onClick={logout} className="text-sm text-muted hover:text-white">خروج</button>
      </div>
      <div className="signal-bar -mt-4" />

      <div className="flex gap-2 border-b border-line">
        {[["streamers", "استریمرها"], ["donations", "تراکنش‌ها"], ["settings", "تنظیمات پلتفرم"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm border-b-2 transition ${tab === k ? "border-signal text-white" : "border-transparent text-muted-dim"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "streamers" && (
        <div className="flex flex-col gap-3">
          <button onClick={() => setShowCreate(true)} className="self-start btn-primary px-4 py-2 text-sm">+ استریمر جدید</button>
          <div className="flex flex-col gap-2">
            {streamers.map((s) => (
              <div key={s.id} className="panel p-3 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium">{s.display_name} <span className="text-muted-dim">@{s.username}</span></div>
                  <div className="text-muted-dim text-xs">/d/{s.slug}</div>
                  {s.goal_title && <div className="text-muted text-xs mt-1">{s.goal_title}: {s.goal_current_toman?.toLocaleString()} / {s.goal_amount_toman?.toLocaleString()} تومان</div>}
                </div>
                <div className="flex items-center gap-2">
                  {!s.is_active && <span className="text-xs text-red-400">غیرفعال</span>}
                  <button onClick={async () => { const r = await fetch(`/api/admin/streamers/${s.id}`); const d = await r.json(); setEditing({ ...d.streamer, kick_url: d.streamer.kick_channel, youtube_url: d.streamer.youtube_channel }); }} className="text-signal text-xs hover:underline">ویرایش</button>
                </div>
              </div>
            ))}
            {streamers.length === 0 && <div className="text-muted-dim text-sm text-center py-8">هنوز استریمری اضافه نشده</div>}
          </div>
        </div>
      )}

      {tab === "donations" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            {["", "toman", "forex", "crypto"].map((m) => (
              <button key={m} onClick={() => setFilterMethod(m)} data-active={filterMethod === m} className="chip px-3 py-1.5 text-xs">
                {m ? methodLabel[m] : "همه روش‌ها"}
              </button>
            ))}
            {["", "pending", "confirmed", "settled", "failed"].map((st) => (
              <button key={st} onClick={() => setFilterStatus(st)} data-active={filterStatus === st} className="chip px-3 py-1.5 text-xs">
                {st ? statusLabel[st] : "همه وضعیت‌ها"}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {donations.map((d) => (
              <div key={d.id} className="panel p-3 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <div>
                    <span className="font-medium">{d.donor_name}</span>
                    <span className="text-muted-dim text-xs mr-2"> → {d.streamer_name}</span>
                  </div>
                  <div>{d.amount?.toLocaleString()} {d.currency}</div>
                </div>
                <div className="flex justify-between text-xs text-muted-dim">
                  <span>{methodLabel[d.method]} · {new Date(d.created_at).toLocaleString("fa-IR")}</span>
                  <span>{statusLabel[d.status]}</span>
                </div>
                {d.method === "toman" && d.status === "pending" && (
                  <button onClick={() => doSettleAction(d, "settle")} className="self-start text-xs bg-green-700 hover:bg-green-600 rounded px-3 py-1">تایید واریز کارت‌به‌کارت</button>
                )}
                {d.method !== "toman" && d.status === "pending" && (
                  <button onClick={() => doSettleAction(d, "confirm")} className="self-start text-xs bg-blue-700 hover:bg-blue-600 rounded px-3 py-1">تایید دریافت وجه</button>
                )}
                {d.method !== "toman" && d.status === "confirmed" && (
                  <button onClick={() => setSettleTarget(d)} className="self-start text-xs bg-green-700 hover:bg-green-600 rounded px-3 py-1">تسویه با استریمر</button>
                )}
              </div>
            ))}
            {donations.length === 0 && <div className="text-muted-dim text-sm text-center py-8">تراکنشی یافت نشد</div>}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <form onSubmit={saveSettings} className="panel p-4 flex flex-col gap-3 max-w-md">
          <div className="text-sm text-muted">حساب‌های مشترک پلتفرم برای دریافت دونیت ارزی و رمزارزی (فقط پیش از انتقال به استریمر)</div>
          <Field label="ایمیل پی‌پال پلتفرم" value={settings.forex_paypal_email} onChange={(v: string) => setSettings({ ...settings, forex_paypal_email: v })} />
          <Field label="آدرس ولت USDT" value={settings.crypto_usdt_address} onChange={(v: string) => setSettings({ ...settings, crypto_usdt_address: v })} />
          <Field label="شبکه (مثلاً TRC20)" value={settings.crypto_network} onChange={(v: string) => setSettings({ ...settings, crypto_network: v })} />
          <Field label="درصد کسر از نرخ لحظه‌ای ارز (پیش‌فرض ۱۰)" type="number" value={settings.default_platform_fee_percent} onChange={(v: string) => setSettings({ ...settings, default_platform_fee_percent: Number(v) })} />
          <button className="btn-primary py-2.5 mt-2">ذخیره</button>
        </form>
      )}

      {showCreate && <StreamerFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); loadStreamers(); }} />}
      {editing && <StreamerFormModal streamer={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadStreamers(); }} />}
      {settleTarget && (
        <SettleModal donation={settleTarget} onClose={() => setSettleTarget(null)} onConfirm={(extra: any) => doSettleAction(settleTarget, "settle", extra)} />
      )}
    </main>
  );
}

function Field({ label, value, onChange, textarea, type }: any) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {textarea ? (
        <textarea className="field px-3 py-2" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type || "text"} className="field px-3 py-2" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function StreamerFormModal({ streamer, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>(streamer || {});
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const url = streamer ? `/api/admin/streamers/${streamer.id}` : "/api/admin/streamers";
    const method = streamer ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "خطا");
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="panel p-5 w-full max-w-md flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold">{streamer ? "ویرایش استریمر" : "استریمر جدید"}</h2>
        {error && <div className="text-red-400 text-sm bg-red-950/50 rounded p-2">{error}</div>}
        <Field label="نام نمایشی" value={form.display_name} onChange={(v: string) => setForm({ ...form, display_name: v })} />
        {!streamer && <Field label="یوزرنیم ورود" value={form.username} onChange={(v: string) => setForm({ ...form, username: v })} />}
        {!streamer && <Field label="اسلاگ لینک (اختیاری)" value={form.slug} onChange={(v: string) => setForm({ ...form, slug: v })} />}
        <Field label={streamer ? "رمز جدید (اختیاری)" : "رمز عبور"} type="password" value={form.password} onChange={(v: string) => setForm({ ...form, password: v })} />
        <Field label="بیوگرافی" textarea value={form.bio} onChange={(v: string) => setForm({ ...form, bio: v })} />
        <Field label="لینک آواتار" value={form.avatar_url} onChange={(v: string) => setForm({ ...form, avatar_url: v })} />
        <Field label="عنوان هدف" value={form.goal_title} onChange={(v: string) => setForm({ ...form, goal_title: v })} />
        <Field label="مبلغ هدف (تومان)" value={form.goal_amount_toman} onChange={(v: string) => setForm({ ...form, goal_amount_toman: v })} />
        <Field label="مرچنت آیدی درگاه پرداخت (زرین‌پال)" value={form.zarinpal_merchant_id} onChange={(v: string) => setForm({ ...form, zarinpal_merchant_id: v })} />
        <div className="text-xs text-muted-dim border-t border-line pt-2">ویجت ویورهای زنده</div>
        <Field label="لینک کانال کیک (اختیاری)" value={form.kick_url} onChange={(v: string) => setForm({ ...form, kick_url: v })} />
        <Field label="لینک کانال یوتیوب (اختیاری)" value={form.youtube_url} onChange={(v: string) => setForm({ ...form, youtube_url: v })} />
        <div className="text-xs text-muted-dim border-t border-line pt-2">حساب تسویه (برای واریز دونیت ارزی/رمزارزی بعد از ۲۴ ساعت)</div>
        <Field label="شماره کارت" value={form.payout_bank_card} onChange={(v: string) => setForm({ ...form, payout_bank_card: v })} />
        <Field label="شماره شبا" value={form.payout_bank_sheba} onChange={(v: string) => setForm({ ...form, payout_bank_sheba: v })} />
        <Field label="نام صاحب حساب" value={form.payout_bank_owner_name} onChange={(v: string) => setForm({ ...form, payout_bank_owner_name: v })} />
        {streamer && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })} />
            فعال
          </label>
        )}
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-2.5">انصراف</button>
          <button className="flex-1 btn-primary py-2.5">ذخیره</button>
        </div>
      </form>
    </div>
  );
}

function SettleModal({ donation, onClose, onConfirm }: any) {
  const [fxRate, setFxRate] = useState("");
  const [fee, setFee] = useState("0");
  const [fetching, setFetching] = useState(false);
  const [rateInfo, setRateInfo] = useState("");

  async function fetchLiveRate() {
    setFetching(true);
    setRateInfo("");
    const res = await fetch(`/api/admin/exchange-rate?currency=${donation.currency}`);
    const data = await res.json();
    setFetching(false);
    if (!res.ok) { setRateInfo(data.error || "خطا در دریافت نرخ"); return; }
    setFxRate(String(data.final_rate));
    setRateInfo(`نرخ لحظه‌ای: ${data.live_rate.toLocaleString()} تومان — منهای ${data.margin_percent}٪ = ${data.final_rate.toLocaleString()} تومان`);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="panel p-5 w-full max-w-sm flex flex-col gap-3">
        <h2 className="font-bold">تسویه با {donation.streamer_name}</h2>
        <p className="text-xs text-muted-dim">
          مبلغ دونیت: {donation.amount} {donation.currency}. نرخ تبدیل و کارمزد بر عهده استریمره — نرخی که وارد می‌کنید مبنای افزایش پیشرفت هدف او خواهد بود.
        </p>
        {["USD", "EUR", "USDT"].includes(donation.currency) && (
          <button type="button" onClick={fetchLiveRate} disabled={fetching} className="btn-secondary py-2 text-sm disabled:opacity-50">
            {fetching ? "..." : "دریافت نرخ لحظه‌ای (الان‌چند)"}
          </button>
        )}
        {rateInfo && <div className="text-xs text-muted-dim">{rateInfo}</div>}
        <Field label="نرخ تبدیل به تومان (هر واحد)" type="number" value={fxRate} onChange={setFxRate} />
        <Field label={`کارمزد (${donation.currency})`} type="number" value={fee} onChange={setFee} />
        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="flex-1 btn-secondary py-2.5">انصراف</button>
          <button
            onClick={() => onConfirm({ fx_rate_at_settlement: Number(fxRate), platform_fee_amount: Number(fee) })}
            disabled={!fxRate}
            className="flex-1 bg-green-700 hover:bg-green-600 rounded-lg py-2.5 disabled:opacity-40"
          >تایید تسویه</button>
        </div>
      </div>
    </div>
  );
}
