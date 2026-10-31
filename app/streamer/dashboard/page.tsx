"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const methodLabel: Record<string, string> = { toman: "تومنی", forex: "ارزی", crypto: "رمزارزی" };
const statusLabel: Record<string, string> = {
  pending: "در انتظار", confirmed: "تایید شده", settled: "تسویه شده", failed: "ناموفق", cancelled: "لغو شده",
};
const statusColor: Record<string, string> = {
  pending: "text-yellow-400", confirmed: "text-blue-400", settled: "text-green-400",
  failed: "text-red-400", cancelled: "text-muted-dim",
};

export default function StreamerDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [totals, setTotals] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [tab, setTab] = useState<"overview" | "transactions" | "tools" | "settings">("overview");
  const [filterMethod, setFilterMethod] = useState<string>("");
  const [form, setForm] = useState<any>({});
  const [saveMsg, setSaveMsg] = useState("");
  const [widgets, setWidgets] = useState<any[]>([]);

  async function load() {
    const res = await fetch("/api/streamer/me");
    if (res.status === 401) return router.push("/streamer/login");
    const data = await res.json();
    setMe(data.streamer);
    setTotals(data.totals || []);
    setForm(data.streamer);
  }

  async function loadDonations(method?: string) {
    const q = method ? `?method=${method}` : "";
    const res = await fetch(`/api/streamer/donations${q}`);
    const data = await res.json();
    setDonations(data.donations || []);
  }

  async function loadWidgets() {
    const res = await fetch("/api/streamer/widgets");
    const data = await res.json();
    setWidgets(data.widgets || []);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === "tools") loadWidgets(); }, [tab]);
  useEffect(() => { if (tab === "transactions") loadDonations(filterMethod); }, [tab, filterMethod]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg("");
    const res = await fetch("/api/streamer/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: form.display_name, bio: form.bio, avatar_url: form.avatar_url,
        goal_title: form.goal_title, goal_amount_toman: Number(form.goal_amount_toman) || 0,
        username: form.username, slug: form.slug,
        ...(form.password ? { password: form.password } : {}),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setSaveMsg("ذخیره شد ✅");
      setForm({ ...form, password: "" });
      load();
    } else {
      setSaveMsg(data.error || "خطا در ذخیره");
    }
  }

  if (!me) return <main className="flex-1 flex items-center justify-center">در حال بارگذاری...</main>;

  const donateLink = typeof window !== "undefined" ? `${window.location.origin}/d/${me.slug}` : "";
  const progress = me.goal_amount_toman > 0 ? Math.min(100, (me.goal_current_toman / me.goal_amount_toman) * 100) : 0;

  const tomanTotal = totals.find((t) => t.method === "toman");
  const forexTotal = totals.find((t) => t.method === "forex");
  const cryptoTotal = totals.find((t) => t.method === "crypto");

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="on-air-dot" />
          <h1 className="text-xl font-bold">پنل {me.display_name}</h1>
        </div>
        <button onClick={logout} className="text-sm text-muted hover:text-white">خروج</button>
      </div>
      <div className="signal-bar -mt-4" />

      <div className="panel p-4 flex flex-col gap-2">
        <div className="text-sm text-muted">لینک اختصاصی دونیت شما</div>
        <div className="flex gap-2">
          <input readOnly value={donateLink} className="flex-1 field px-3 py-2 text-sm" />
          <button
            onClick={() => navigator.clipboard.writeText(donateLink)}
            className="btn-primary px-4 text-sm"
          >کپی</button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-line">
        {[["overview", "نمای کلی"], ["transactions", "تراکنش‌ها"], ["tools", "ابزارها"], ["settings", "تنظیمات"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm border-b-2 transition ${tab === k ? "border-signal text-white" : "border-transparent text-muted-dim"}`}
          >{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          {me.goal_title && (
            <div className="panel p-4">
              <div className="flex justify-between text-sm mb-2">
                <span>{me.goal_title}</span>
                <span className="text-muted amount">{me.goal_current_toman?.toLocaleString()} / {me.goal_amount_toman?.toLocaleString()} تومان</span>
              </div>
              <div className="h-3 progress-track">
                <div className="h-full progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="دونیت تومنی" confirmed={tomanTotal?.confirmed_amount} pending={tomanTotal?.pending_amount} unit="تومان" />
            <StatCard title="دونیت ارزی" confirmed={forexTotal?.confirmed_amount} pending={forexTotal?.pending_amount} unit="$" />
            <StatCard title="دونیت رمزارزی" confirmed={cryptoTotal?.confirmed_amount} pending={cryptoTotal?.pending_amount} unit="USDT" />
          </div>
          <p className="text-xs text-muted-dim">
            توجه: نوسان نرخ ارز/رمزارز تا لحظه تسویه و کارمزد تراکنش‌های ارزی و رمزارزی بر عهده شماست.
          </p>
        </div>
      )}

      {tab === "transactions" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {["", "toman", "forex", "crypto"].map((m) => (
              <button
                key={m}
                onClick={() => setFilterMethod(m)}
                data-active={filterMethod === m}
                className="chip px-3 py-1.5 text-sm"
              >{m ? methodLabel[m] : "همه"}</button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {donations.length === 0 && <div className="text-muted-dim text-sm text-center py-8">تراکنشی یافت نشد</div>}
            {donations.map((d) => (
              <div key={d.id} className="panel p-3 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium">{d.donor_name}</div>
                  <div className="text-muted-dim text-xs">{new Date(d.created_at).toLocaleString("fa-IR")}</div>
                  {d.donor_message && <div className="text-muted text-xs mt-1">{d.donor_message}</div>}
                </div>
                <div className="text-left">
                  <div className="amount text-gold">{d.amount?.toLocaleString()} {d.currency}</div>
                  <div className={`text-xs ${statusColor[d.status]}`}>{statusLabel[d.status]}</div>
                  <div className="text-xs text-muted-dim">{methodLabel[d.method]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "tools" && (
        <ToolsSection me={me} widgets={widgets} onSaved={load} loadWidgets={loadWidgets} />
      )}


      {tab === "settings" && (
        <form onSubmit={saveProfile} className="panel p-4 flex flex-col gap-3">
          {saveMsg && <div className="text-sm text-green-400">{saveMsg}</div>}
          <Field label="نام نمایشی" value={form.display_name} onChange={(v: string) => setForm({ ...form, display_name: v })} />
          <Field label="بیوگرافی" value={form.bio} onChange={(v: string) => setForm({ ...form, bio: v })} textarea />
          <Field label="لینک آواتار" value={form.avatar_url} onChange={(v: string) => setForm({ ...form, avatar_url: v })} />
          <Field label="عنوان هدف" value={form.goal_title} onChange={(v: string) => setForm({ ...form, goal_title: v })} />
          <Field label="مبلغ هدف (تومان)" value={form.goal_amount_toman} onChange={(v: string) => setForm({ ...form, goal_amount_toman: v })} />

          <div className="text-xs text-muted-dim border-t border-line pt-3">اطلاعات حساب</div>
          <Field label="یوزرنیم ورود" value={form.username} onChange={(v: string) => setForm({ ...form, username: v })} />
          <Field label="اسلاگ لینک (URL) — مثلاً alexijo" value={form.slug} onChange={(v: string) => setForm({ ...form, slug: v })} />
          <Field label="رمز عبور جدید (خالی بگذار اگه نمی‌خوای عوض کنی)" type="password" value={form.password} onChange={(v: string) => setForm({ ...form, password: v })} />

          <div className="text-xs text-muted-dim border-t border-line pt-3">
            شماره کارت/شبا و مرچنت درگاه پرداخت فقط توسط ادمین قابل تغییره — برای تغییر با ادمین هماهنگ کنید.
          </div>
          <button className="btn-primary py-2.5 mt-2">ذخیره</button>
        </form>
      )}
    </main>
  );
}

function StatCard({ title, confirmed, pending, unit }: any) {
  return (
    <div className="panel p-4">
      <div className="text-sm text-muted mb-2">{title}</div>
      <div className="text-lg font-bold amount">{(confirmed || 0).toLocaleString()} <span className="text-xs text-muted-dim">{unit}</span></div>
      <div className="text-xs text-yellow-500 mt-1">در انتظار: {(pending || 0).toLocaleString()} {unit}</div>
    </div>
  );
}

const widgetLabels: Record<string, string> = {
  goal: "هدف دونیت", donors: "لیست دونیتورها", donations: "لیست دونیت‌ها", alert: "گیف/ویدیو دونیت",
};

const toolLabels: Record<string, string> = {
  clock: "ساعت شنی دوناتون",
  viewers: "ویورهای زنده",
  goal: "هدف دونیت",
  donors: "لیست دونیتورها",
  donations: "لیست دونیت‌ها",
  alert: "گیف/ویدیو دونیت",
};

function ToolsSection({ me, widgets, onSaved, loadWidgets }: any) {
  const [editing, setEditing] = useState<string | null>(null);

  if (editing) {
    const previewUrl: Record<string, string> = {
      clock: `/w/${me.slug}/clock`,
      goal: `/w/${me.slug}/goal`,
      donors: `/w/${me.slug}/donors`,
      donations: `/w/${me.slug}/donations`,
      alert: `/w/${me.slug}/alert`,
    };

    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setEditing(null)} className="btn-secondary self-start px-4 py-2 text-sm">← بازگشت به ابزارها</button>
        <h2 className="text-lg font-bold">{toolLabels[editing]}</h2>

        {previewUrl[editing] && <PreviewFrame url={previewUrl[editing]} />}

        {editing === "clock" && <ClockCard me={me} onSaved={onSaved} />}
        {editing === "viewers" && <ViewersWidgetCard me={me} onSaved={onSaved} />}
        {!["clock", "viewers"].includes(editing) && (
          <WidgetCard
            widget={widgets.find((w: any) => w.widget_type === editing)}
            slug={me.slug}
            onSaved={loadWidgets}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-dim">
        هر لینک رو به‌عنوان Browser Source توی OBS اضافه کن (پس‌زمینه شفافه). سایز و طرح رو خودت توی OBS تنظیم کن.
      </p>
      <TestDonateCard />
      <ToolListRow title={toolLabels.clock} onEdit={() => setEditing("clock")} />
      {(me.kick_channel || me.youtube_channel) && (
        <ToolListRow title={toolLabels.viewers} onEdit={() => setEditing("viewers")} />
      )}
      {widgets.map((w: any) => (
        <ToolListRow key={w.widget_type} title={toolLabels[w.widget_type]} onEdit={() => setEditing(w.widget_type)} />
      ))}
    </div>
  );
}

function ToolListRow({ title, onEdit }: any) {
  return (
    <div className="panel p-4 flex items-center justify-between">
      <span className="font-bold">{title}</span>
      <button onClick={onEdit} className="btn-primary px-4 py-2 text-sm">ادیت</button>
    </div>
  );
}

function PreviewFrame({ url }: any) {
  const [full, setFull] = useState("");
  useEffect(() => { setFull(`${window.location.origin}${url}`); }, [url]);

  return (
    <div className="panel p-3">
      <div className="text-xs text-muted-dim mb-2">پیش‌نمایش زنده — دقیقاً همینه که توی OBS دیده میشه</div>
      <div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundImage: "repeating-conic-gradient(#2a2a2a 0% 25%, #1c1c1c 0% 50%)",
          backgroundSize: "20px 20px",
        }}
      >
        {full && <iframe src={full} className="w-full h-[260px] border-0" title="پیش‌نمایش ویجت" />}
      </div>
    </div>
  );
}

function TestDonateCard() {
  const [amount, setAmount] = useState(10000);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function trigger() {
    setSending(true);
    setMsg("");
    const res = await fetch("/api/streamer/test-donate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    setSending(false);
    setMsg(res.ok ? "دونیت تستی ارسال شد ✅ ویجت الرت رو چک کن" : "خطا در ارسال");
  }

  return (
    <div className="panel p-4 flex flex-col gap-2">
      <h3 className="font-bold">تست دونیت</h3>
      <p className="text-xs text-muted-dim">با نام «تست» یه دونیت آزمایشی می‌فرسته تا صدا و انیمیشن ویجت الرت رو چک کنی — روی آمار واقعی تاثیری نداره.</p>
      <div className="flex gap-2 items-center">
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="field px-3 py-2 text-sm w-32" />
        <button onClick={trigger} disabled={sending} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {sending ? "..." : "ارسال دونیت تستی"}
        </button>
      </div>
      {msg && <div className="text-xs text-green-500">{msg}</div>}
    </div>
  );
}

function ClockCard({ me, onSaved }: any) {
  const [hours, setHours] = useState(me.clock_initial_hours || 0);
  const [rate, setRate] = useState(me.clock_toman_per_minute || 0);
  const [color, setColor] = useState(me.clock_color || "#f2b84b");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const clockUrl = typeof window !== "undefined" ? `${window.location.origin}/w/${me.slug}/clock` : "";

  async function save() {
    setSaving(true);
    setMsg("");
    await fetch("/api/streamer/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clock_initial_hours: hours, clock_toman_per_minute: rate, clock_color: color }),
    });
    setSaving(false);
    setMsg("ذخیره شد ✅");
    onSaved();
  }

  async function startClock() {
    setMsg("");
    const res = await fetch("/api/streamer/clock/start", { method: "POST" });
    const data = await res.json();
    setMsg(res.ok ? "ساعت شروع شد ✅" : data.error);
    onSaved();
  }

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <h3 className="font-bold">ساعت شنی دوناتون</h3>
      <div className="flex gap-2">
        <input readOnly value={clockUrl} className="flex-1 field px-3 py-2 text-xs font-mono" />
        <button onClick={() => navigator.clipboard.writeText(clockUrl)} className="btn-primary px-3 text-xs">کپی لینک OBS</button>
      </div>
      {msg && <div className="text-xs text-green-500">{msg}</div>}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          ساعت اولیه
          <input type="number" step="0.5" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="field px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          هر دقیقه چند تومان
          <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="field px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted col-span-2">
          رنگ ساعت
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-full field" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-secondary px-4 py-2 text-sm">{saving ? "..." : "ذخیره تنظیمات"}</button>
        <button onClick={startClock} className="btn-primary px-4 py-2 text-sm">شروع / ریست ساعت</button>
      </div>
      <p className="text-xs text-muted-dim">
        با هر دونیت تسویه‌شده، به‌اندازه‌ی «مبلغ ÷ نرخ» دقیقه به ساعت اضافه میشه. با زدن «شروع/ریست»، ساعت از نو با «ساعت اولیه» شروع میشه.
      </p>
    </div>
  );
}

function ViewersWidgetCard({ me, onSaved }: any) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(platform: "kick" | "youtube", next: boolean) {
    setBusy(platform);
    await fetch("/api/streamer/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [`${platform}_enabled`]: next }),
    });
    setBusy(null);
    onSaved();
  }

  const kickUrl = typeof window !== "undefined" ? `${window.location.origin}/w/${me.slug}/viewers/kick` : "";
  const youtubeUrl = typeof window !== "undefined" ? `${window.location.origin}/w/${me.slug}/viewers/youtube` : "";

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <h3 className="font-bold">ویورهای زنده</h3>

      {me.kick_channel && (
        <div className="flex flex-col gap-2 border-b border-line pb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">کیک — {me.kick_channel}</span>
            <button
              onClick={() => toggle("kick", !me.kick_enabled)}
              disabled={busy === "kick"}
              title={me.kick_enabled ? "غیرفعال کردن" : "فعال کردن"}
              className="text-xl leading-none disabled:opacity-40"
              style={{ color: me.kick_enabled ? "#53FC18" : "#555" }}
            >
              {me.kick_enabled ? "👁" : "🚫"}
            </button>
          </div>
          {me.kick_enabled && (
            <div className="flex gap-2">
              <input readOnly value={kickUrl} className="flex-1 field px-3 py-2 text-xs font-mono" />
              <button onClick={() => navigator.clipboard.writeText(kickUrl)} className="btn-primary px-3 text-xs">کپی لینک OBS</button>
            </div>
          )}
        </div>
      )}

      {me.youtube_channel && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">یوتیوب — {me.youtube_channel}</span>
            <button
              onClick={() => toggle("youtube", !me.youtube_enabled)}
              disabled={busy === "youtube"}
              title={me.youtube_enabled ? "غیرفعال کردن" : "فعال کردن"}
              className="text-xl leading-none disabled:opacity-40"
              style={{ color: me.youtube_enabled ? "#FF0000" : "#555" }}
            >
              {me.youtube_enabled ? "👁" : "🚫"}
            </button>
          </div>
          {me.youtube_enabled && (
            <div className="flex gap-2">
              <input readOnly value={youtubeUrl} className="flex-1 field px-3 py-2 text-xs font-mono" />
              <button onClick={() => navigator.clipboard.writeText(youtubeUrl)} className="btn-primary px-3 text-xs">کپی لینک OBS</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WidgetCard({ widget, slug, onSaved }: any) {
  const [config, setConfig] = useState<any>(widget.config || {});
  const [volume, setVolume] = useState<number>(widget.volume ?? 0.5);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const widgetUrl = typeof window !== "undefined" ? `${window.location.origin}/w/${slug}/${widget.widget_type}` : "";
  const tiers: any[] = Array.isArray(config.tiers) ? config.tiers : [];

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/streamer/widgets/${widget.widget_type}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, volume }),
    });
    setSaving(false);
    if (res.ok) { setMsg("ذخیره شد ✅"); onSaved(); } else setMsg("خطا در ذخیره");
  }

  async function upload(kind: "media" | "sound", file: File, tierIndex?: number) {
    if (file.size > 10 * 1024 * 1024) {
      setMsg("حجم فایل نباید بیشتر از ۱۰ مگابایت باشد");
      return;
    }
    setUploading(true);
    setMsg("");
    const fd = new FormData();
    fd.append("widget_type", widget.widget_type);
    fd.append("kind", kind);
    fd.append("file", file);
    if (tierIndex !== undefined) fd.append("tier_index", String(tierIndex));
    const res = await fetch("/api/streamer/widgets/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) { setMsg("آپلود شد ✅"); onSaved(); } else setMsg(data.error || "خطا در آپلود");
  }

  function addTier() {
    if (tiers.length >= 15) return;
    setConfig({ ...config, tiers: [...tiers, { max_amount: 0, media_url: null, media_type: null, sound_url: null, volume: 0.5 }] });
  }
  function updateTier(i: number, patch: any) {
    const next = tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    setConfig({ ...config, tiers: next });
  }
  function removeTier(i: number) {
    setConfig({ ...config, tiers: tiers.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="panel p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">{widgetLabels[widget.widget_type]}</h3>
      </div>

      <div className="flex gap-2">
        <input readOnly value={widgetUrl} className="flex-1 field rounded-lg px-3 py-2 text-xs font-mono" />
        <button onClick={() => navigator.clipboard.writeText(widgetUrl)} className="btn-primary px-3 text-xs whitespace-nowrap">کپی لینک OBS</button>
      </div>

      {msg && <div className="text-xs text-signal">{msg}</div>}

      {/* ---- قالب ---- */}
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="text-xs text-muted-dim font-bold">قالب</div>
        {widget.widget_type === "goal" && (
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="رنگ موج آب" value={config.wave_color} onChange={(v: string) => setConfig({ ...config, wave_color: v })} />
            <ColorField label="رنگ متن" value={config.text_color} onChange={(v: string) => setConfig({ ...config, text_color: v })} />
          </div>
        )}
        {widget.widget_type === "donors" && (
          <div className="grid grid-cols-2 gap-2">
            <MiniField label="عنوان" value={config.title} onChange={(v: string) => setConfig({ ...config, title: v })} />
            <MiniField label="تعداد نفرات" type="number" value={config.max_items} onChange={(v: string) => setConfig({ ...config, max_items: Number(v) })} />
            <ColorField label="رنگ متن" value={config.text_color} onChange={(v: string) => setConfig({ ...config, text_color: v })} />
          </div>
        )}
        {widget.widget_type === "donations" && (
          <div className="grid grid-cols-2 gap-2">
            <MiniField label="تعداد آیتم" type="number" value={config.max_items} onChange={(v: string) => setConfig({ ...config, max_items: Number(v) })} />
            <ColorField label="رنگ متن" value={config.text_color} onChange={(v: string) => setConfig({ ...config, text_color: v })} />
          </div>
        )}
        {widget.widget_type === "alert" && (
          <div className="flex flex-col gap-2">
            <MiniField label="متن نمایش — از {name} و {amount} استفاده کن" value={config.message_template} onChange={(v: string) => setConfig({ ...config, message_template: v })} />
            <div className="grid grid-cols-2 gap-2">
              <MiniField label="مدت نمایش (ثانیه)" type="number" value={config.duration_seconds} onChange={(v: string) => setConfig({ ...config, duration_seconds: Number(v) })} />
              <ColorField label="رنگ متن" value={config.text_color} onChange={(v: string) => setConfig({ ...config, text_color: v })} />
            </div>
          </div>
        )}
      </div>

      {/* ---- صدا و رسانه ---- */}
      {widget.widget_type !== "alert" && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="text-xs text-muted-dim font-bold">صدا و رسانه</div>

          {widget.widget_type === "goal" && (
            <p className="text-xs text-muted-dim">
              اندازه پیشنهادی پس‌زمینه: ۸۰۰×۲۲۰ پیکسل. برای پس‌زمینه متحرک فقط <b>گیف لوپ‌شونده</b> پشتیبانی میشه (ویدیوی mp4 خیر).
            </p>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">میزان صدا: {Math.round(volume * 100)}%</span>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          </div>

          <div className="flex flex-col gap-1 text-xs text-muted-dim">
            {widget.sound_url && <span className="text-green-500">فایل صدا آپلود شده ✅</span>}
            {widget.media_url && <span className="text-green-500">فایل تصویر/ویدیو آپلود شده ✅</span>}
          </div>

          <input ref={soundInputRef} type="file" accept="audio/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && upload("sound", e.target.files[0])} />
          <input ref={mediaInputRef} type="file" accept={widget.widget_type === "goal" ? "image/*" : "image/*,video/*"} className="hidden"
            onChange={(e) => e.target.files?.[0] && upload("media", e.target.files[0])} />

          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => soundInputRef.current?.click()} disabled={uploading} className="btn-secondary px-4 py-2 text-sm disabled:opacity-50">
              {uploading ? "..." : "افزودن صدا"}
            </button>
            <button type="button" onClick={() => mediaInputRef.current?.click()} disabled={uploading} className="btn-secondary px-4 py-2 text-sm disabled:opacity-50">
              {uploading ? "..." : widget.widget_type === "goal" ? "افزودن پس‌زمینه" : "افزودن تصویر/ویدیو"}
            </button>
          </div>
        </div>
      )}

      {/* ---- سطح‌بندی مبلغ (فقط ویجت الرت) ---- */}
      {widget.widget_type === "alert" && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-dim font-bold">سطح‌بندی مبلغ ({tiers.length}/15)</div>
            <button type="button" onClick={addTier} disabled={tiers.length >= 15} className="btn-secondary px-3 py-1 text-xs disabled:opacity-40">
              + افزودن سطح
            </button>
          </div>
          <p className="text-xs text-muted-dim">
            هر سطح یعنی: «تا این مبلغ (تومان) → این گیف/ویدیو + این صدا با این میزان صدا». مبلغ‌های بالاتر از بزرگ‌ترین سطح، همون سطح آخر رو نشون میدن.
          </p>
          {tiers.map((t, i) => (
            <TierRow key={i} index={i} tier={t} onChange={(patch: any) => updateTier(i, patch)} onRemove={() => removeTier(i)} onUpload={upload} />
          ))}
          {tiers.length === 0 && (
            <p className="text-xs text-muted-dim">هنوز سطحی اضافه نکردی — بدون سطح، هیچ گیف/صدایی پخش نمیشه.</p>
          )}
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50 self-start">
        {saving ? "..." : "ذخیره تنظیمات"}
      </button>
    </div>
  );
}

function TierRow({ index, tier, onChange, onRemove, onUpload }: any) {
  const [uploading, setUploading] = useState(false);
  const soundRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  async function handleUpload(kind: "media" | "sound", file: File) {
    setUploading(true);
    await onUpload(kind, file, index);
    setUploading(false);
  }

  return (
    <div className="field p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-dim whitespace-nowrap">تا مبلغ (تومان)</span>
        <input
          type="number"
          value={tier.max_amount}
          onChange={(e) => onChange({ max_amount: Number(e.target.value) })}
          className="field px-3 py-1.5 text-sm flex-1"
        />
        <button onClick={onRemove} className="text-signal text-xs whitespace-nowrap">حذف</button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={soundRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload("sound", e.target.files[0])} />
        <input ref={mediaRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload("media", e.target.files[0])} />
        <button type="button" onClick={() => soundRef.current?.click()} disabled={uploading} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">
          {tier.sound_url ? "تغییر صدا ✅" : "افزودن صدا"}
        </button>
        <button type="button" onClick={() => mediaRef.current?.click()} disabled={uploading} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">
          {tier.media_url ? "تغییر گیف/ویدیو ✅" : "افزودن گیف/ویدیو"}
        </button>
        <div className="flex items-center gap-1 flex-1 min-w-[100px]">
          <input type="range" min={0} max={1} step={0.05} value={tier.volume ?? 0.5} onChange={(e) => onChange({ volume: Number(e.target.value) })} className="flex-1" />
          <span className="text-xs text-muted-dim whitespace-nowrap">{Math.round((tier.volume ?? 0.5) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: any) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-8 w-full field rounded" />
    </label>
  );
}

function MiniField({ label, value, onChange, type }: any) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted col-span-2">
      {label}
      <input type={type || "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="field px-3 py-2 text-sm text-white outline-none focus:ring-2 ring-signal" />
    </label>
  );
}

function Field({ label, value, onChange, textarea }: any) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {textarea ? (
        <textarea className="field px-3 py-2" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="field px-3 py-2" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

