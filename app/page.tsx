import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-10 p-8 text-center relative overflow-hidden">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line text-xs text-muted">
          <span className="on-air-dot" />
          <span className="tracking-wide">ON AIR</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black leading-tight">
          پلتفرم <span className="gradient-text">دونیت</span> استریمرها
        </h1>
        <div className="signal-bar w-24" />
        <p className="text-muted max-w-md leading-7">
          هر استریمر یک لینک اختصاصی برای دریافت دونیت تومنی، ارزی و رمزارزی داره —
          با پیشرفت هدف، ویجت‌های زنده برای OBS، و پنل مدیریت کامل.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/streamer/login" className="btn-primary px-7 py-3 text-sm">
          ورود استریمر
        </Link>
        <Link href="/admin/login" className="btn-secondary px-7 py-3 text-sm">
          ورود ادمین
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 w-full max-w-2xl">
        {[
          { label: "دونیت تومنی", desc: "درگاه پرداخت مستقیم" },
          { label: "دونیت ارزی/رمزارزی", desc: "تسویه امن ۲۴ ساعته" },
          { label: "ویجت زنده OBS", desc: "هدف، لیست، هشدار" },
        ].map((f) => (
          <div key={f.label} className="panel panel-hover p-4 text-right">
            <div className="text-sm font-bold mb-1">{f.label}</div>
            <div className="text-xs text-muted-dim">{f.desc}</div>
          </div>
        ))}
      </div>

      <Link href="/about" className="text-xs text-muted-dim hover:text-muted underline">درباره این پلتفرم</Link>
    </main>
  );
}
