"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function WidgetPage() {
  const { slug, type } = useParams<{ slug: string; type: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
  }, []);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/widget/${slug}/${type}`);
        if (res.ok && !stop) setData(await res.json());
      } catch {}
      if (!stop) setTimeout(poll, 4000);
    }
    poll();
    return () => { stop = true; };
  }, [slug, type]);

  if (!data) return null;

  return (
    <div className="min-h-screen bg-transparent" style={{ background: "transparent" }}>
      {type === "goal" && <GoalWidget data={data} />}
      {type === "donors" && <DonorsWidget data={data} />}
      {type === "donations" && <DonationsWidget data={data} />}
      {type === "alert" && <AlertWidget slug={slug} data={data} />}
    </div>
  );
}

function GoalWidget({ data }: any) {
  const c = data.config || {};
  const pct = data.goal_amount_toman > 0 ? Math.min(100, (data.goal_current_toman / data.goal_amount_toman) * 100) : 0;
  const waveColor = c.wave_color || "#3ba7ff";
  const waveSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 24' preserveAspectRatio='none'><path d='M0 12 Q 25 2 50 12 T 100 12 T 150 12 T 200 12 V24 H0 Z' fill='${encodeURIComponent(waveColor)}'/></svg>`;

  return (
    <div className="p-4 w-[420px]" style={{ fontFamily: "Vazirmatn, sans-serif" }}>
      <div
        className="rounded-xl p-4 bg-cover bg-center"
        style={{
          background: data.media_url ? `url(${data.media_url})` : (c.bg_color || "transparent"),
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex justify-between text-sm mb-2" style={{ color: c.text_color || "#fff" }}>
          <span>{data.goal_title || "هدف دونیت"}</span>
          {c.show_percent !== false && <span>{Math.round(pct)}%</span>}
        </div>
        <div className="relative h-10 rounded-full overflow-hidden border" style={{ borderColor: `${waveColor}66`, background: "rgba(255,255,255,0.05)" }}>
          <div className="absolute inset-y-0 right-0 transition-all duration-700 ease-out" style={{ width: `${pct}%` }}>
            <div style={{ background: waveColor, opacity: 0.55, position: "absolute", inset: 0 }} />
            <div
              className="wave-layer"
              style={{
                position: "absolute", inset: 0,
                backgroundImage: `url("data:image/svg+xml,${waveSvg}")`,
                backgroundRepeat: "repeat-x",
                backgroundSize: "100px 100%",
              }}
            />
          </div>
        </div>
        <div className="text-xs mt-1 text-left amount" style={{ color: c.text_color || "#fff" }}>
          {data.goal_current_toman?.toLocaleString()} / {data.goal_amount_toman?.toLocaleString()} تومان
        </div>
      </div>
      <style>{`
        .wave-layer { animation: wave-scroll 2.5s linear infinite; }
        @keyframes wave-scroll { from { background-position-x: 0; } to { background-position-x: 100px; } }
      `}</style>
    </div>
  );
}

function DonorsWidget({ data }: any) {
  const c = data.config || {};
  return (
    <div className="p-4 w-[320px]" style={{ fontFamily: "Vazirmatn, sans-serif" }}>
      <div
        className="rounded-xl p-4 bg-cover bg-center"
        style={{ background: data.media_url ? `url(${data.media_url})` : (c.bg_color || "transparent"), backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="text-sm font-bold mb-2" style={{ color: c.text_color || "#fff" }}>{c.title || "برترین حامیان"}</div>
        <ol className="flex flex-col gap-1">
          {(data.donors || []).map((d: any, i: number) => (
            <li key={i} className="flex justify-between text-sm" style={{ color: c.text_color || "#fff" }}>
              <span>{i + 1}. {d.name}</span>
              <span>{Math.round(d.total).toLocaleString()} ت</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function DonationsWidget({ data }: any) {
  const c = data.config || {};
  return (
    <div className="p-4 w-[360px]" style={{ fontFamily: "Vazirmatn, sans-serif" }}>
      <div
        className="rounded-xl p-4 flex flex-col gap-2 bg-cover bg-center"
        style={{ background: data.media_url ? `url(${data.media_url})` : (c.bg_color || "transparent"), backgroundSize: "cover", backgroundPosition: "center" }}
      >
        {(data.donations || []).map((d: any, i: number) => (
          <div key={i} className="text-sm border-b border-white/10 pb-1" style={{ color: c.text_color || "#fff" }}>
            <div className="flex justify-between">
              <span className="font-medium">{d.donor_name}</span>
              <span>{d.amount?.toLocaleString()} {d.currency}</span>
            </div>
            {d.donor_message && <div className="text-xs opacity-70">{d.donor_message}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function pickTier(tiers: any[], tomanAmount: number) {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const sorted = [...tiers].filter((t) => t.max_amount > 0).sort((a, b) => a.max_amount - b.max_amount);
  const match = sorted.find((t) => tomanAmount <= t.max_amount);
  // If the amount exceeds every tier's ceiling, use the highest tier as a catch-all.
  return match || sorted[sorted.length - 1] || null;
}

function AlertWidget({ slug, data }: any) {
  const c = data.config || {};
  const [current, setCurrent] = useState<any>(null);
  const [tier, setTier] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/widget/${slug}/alert/next`);
        if (res.ok) {
          const d = await res.json();
          if (d.donation && !stop) {
            const matchedTier = pickTier(c.tiers, d.donation.toman_amount || 0);
            setCurrent(d.donation);
            setTier(matchedTier);
            const volume = matchedTier?.volume ?? data.volume ?? 0.5;
            const soundUrl = matchedTier?.sound_url || data.sound_url;
            if (audioRef.current && soundUrl) {
              audioRef.current.src = soundUrl;
              audioRef.current.volume = volume;
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
            const duration = (c.duration_seconds || 6) * 1000;
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setCurrent(null), duration);
          }
        }
      } catch {}
      if (!stop) setTimeout(poll, 2500);
    }
    poll();
    return () => { stop = true; clearTimeout(timeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const message = current
    ? (c.message_template || "{name} مبلغ {amount} دونیت کرد!")
        .replace("{name}", current.donor_name)
        .replace("{amount}", `${current.amount?.toLocaleString()} ${current.method === "toman" ? "تومان" : current.currency}`)
    : "";

  const mediaUrl = tier?.media_url || data.media_url;
  const mediaType = tier?.media_type || data.media_type;

  return (
    <div className="w-[500px] h-[300px] flex items-center justify-center" style={{ fontFamily: "Vazirmatn, sans-serif" }}>
      <audio ref={audioRef} />
      {current && (
        <div className="flex flex-col items-center gap-3 animate-[fadeIn_0.3s_ease]">
          {mediaUrl && mediaType === "video" && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={mediaUrl} autoPlay muted={false} className="max-w-[400px] max-h-[200px]" />
          )}
          {mediaUrl && mediaType === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="max-w-[400px] max-h-[200px]" />
          )}
          <div
            className="text-lg font-bold px-4 py-2 rounded-lg text-center"
            style={{ color: c.text_color || "#fff", background: c.bg_color || "rgba(0,0,0,0.5)" }}
          >
            {message}
          </div>
        </div>
      )}
    </div>
  );
}
