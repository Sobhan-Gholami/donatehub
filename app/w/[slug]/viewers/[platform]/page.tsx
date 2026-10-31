"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const BRAND: Record<string, { color: string; label: string }> = {
  kick: { color: "#53FC18", label: "کیک" },
  youtube: { color: "#FF0000", label: "یوتیوب" },
};

export default function ViewersWidgetPage() {
  const { slug, platform } = useParams<{ slug: string; platform: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
  }, []);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/widget/${slug}/viewers/${platform}`);
        if (res.ok && !stop) setData(await res.json());
      } catch {}
      if (!stop) setTimeout(poll, 2000); // near-instant: refreshes every 2s
    }
    poll();
    return () => { stop = true; };
  }, [slug, platform]);

  const brand = BRAND[platform] || { color: "#ffffff", label: platform };
  if (!data || !data.enabled) return null;

  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl m-3"
      style={{ fontFamily: "Vazirmatn, sans-serif", background: "rgba(10,10,20,0.55)", border: `1px solid ${brand.color}55` }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: data.live ? brand.color : "#666", boxShadow: data.live ? `0 0 8px ${brand.color}` : "none" }}
      />
      <span className="text-sm font-bold" style={{ color: brand.color }}>{brand.label}</span>
      <span
        className="text-lg font-bold"
        style={{ color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
      >
        {data.live ? data.viewers.toLocaleString() : "آفلاین"}
      </span>
    </div>
  );
}
