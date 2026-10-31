"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ClockWidgetPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
  }, []);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/widget/${slug}/clock`);
        if (res.ok && !stop) setData(await res.json());
      } catch {}
      if (!stop) setTimeout(poll, 10000);
    }
    poll();
    return () => { stop = true; };
  }, [slug]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return null;

  const color = data.color || "#f2b84b";
  const endAt = data.clock_end_at ? new Date(data.clock_end_at.replace(" ", "T") + "Z").getTime() : null;

  if (!endAt) {
    return (
      <div
        className="px-4 py-2 rounded-lg text-sm"
        style={{ fontFamily: "Vazirmatn, sans-serif", color: "#fff", background: "rgba(0,0,0,0.55)", border: `1px solid ${color}` }}
      >
        ساعت شنی هنوز شروع نشده — از پنل استریمر «شروع/ریست ساعت» رو بزن
      </div>
    );
  }

  const remainingMs = Math.max(0, endAt - now);
  const totalMs = (data.initial_hours || 0) * 3600 * 1000;
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, (remainingMs / totalMs) * 100)) : 0;

  const hh = Math.floor(remainingMs / 3600000);
  const mm = Math.floor((remainingMs % 3600000) / 60000);
  const ss = Math.floor((remainingMs % 60000) / 1000);
  const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  // Hourglass: sand drains from the top triangle into the bottom one.
  const topSandHeight = 55 * (pct / 100);       // shrinks as time passes
  const bottomSandHeight = 55 * (1 - pct / 100); // grows as time passes

  return (
    <div className="flex flex-col items-center gap-2 p-3" style={{ fontFamily: "Vazirmatn, sans-serif" }}>
      <svg width="90" height="130" viewBox="0 0 100 140">
        <defs>
          <clipPath id="topTri"><polygon points="12,10 88,10 50,66" /></clipPath>
          <clipPath id="botTri"><polygon points="50,74 88,130 12,130" /></clipPath>
        </defs>
        {/* glass outline */}
        <polygon points="12,10 88,10 50,66 88,130 12,130 50,66" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        {/* sand: top (draining) */}
        <g clipPath="url(#topTri)">
          <rect x="12" y={66 - topSandHeight} width="76" height={topSandHeight} fill={color} opacity="0.85" />
        </g>
        {/* sand: bottom (filling) */}
        <g clipPath="url(#botTri)">
          <rect x="12" y={130 - bottomSandHeight} width="76" height={bottomSandHeight} fill={color} opacity="0.85" />
        </g>
      </svg>
      <div
        className="amount text-xl font-bold px-3 py-1 rounded-lg"
        style={{ color: "#fff", background: "rgba(0,0,0,0.55)", border: `1px solid ${color}` }}
      >
        {timeStr}
      </div>
    </div>
  );
}
