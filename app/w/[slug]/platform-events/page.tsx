"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

const LABELS: Record<string, string> = {
  follow: "دنبال کرد", sub: "ساب کرد", gifted_sub: "ساب هدیه داد", membership: "ممبر شد",
};
const BRAND: Record<string, string> = { kick: "#53FC18", youtube: "#FF0000" };

export default function PlatformEventsWidget() {
  const { slug } = useParams<{ slug: string }>();
  const [current, setCurrent] = useState<any>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
  }, []);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/widget/${slug}/platform-events/next`);
        if (res.ok) {
          const d = await res.json();
          if (d.event && !stop) {
            setCurrent(d.event);
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setCurrent(null), 6000);
          }
        }
      } catch {}
      if (!stop) setTimeout(poll, 2500);
    }
    poll();
    return () => { stop = true; clearTimeout(timeoutRef.current); };
  }, [slug]);

  if (!current) return null;
  const color = BRAND[current.platform] || "#fff";

  return (
    <div
      className="inline-flex flex-col items-center gap-1 px-6 py-4 rounded-xl m-3"
      style={{ fontFamily: "Vazirmatn, sans-serif", background: "rgba(10,10,20,0.65)", border: `1px solid ${color}` }}
    >
      <div className="text-sm font-bold" style={{ color }}>{current.platform === "kick" ? "کیک" : "یوتیوب"}</div>
      <div className="text-xl font-bold text-white">
        {current.username} {LABELS[current.event_type] || current.event_type}!
      </div>
    </div>
  );
}
