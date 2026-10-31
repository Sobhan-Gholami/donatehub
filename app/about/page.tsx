import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full p-6 md:p-10 flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line text-xs text-muted">
          <span className="on-air-dot" />
          <span className="tracking-wide">درباره ما</span>
        </div>
        <h1 className="text-3xl font-black">پلتفرم دونیت استریمرها</h1>
        <div className="signal-bar w-24" />
      </div>

      <div className="panel p-6 flex flex-col gap-4 text-sm leading-8">
        <p>
          این پلتفرم به استریمرها کمک می‌کنه یه صفحه‌ی حرفه‌ای و اختصاصی برای دریافت دونیت داشته باشن — بدون
          نیاز به دانش فنی و بدون سردرگمی بین چندین ابزار مختلف. هر استریمر یک لینک شخصی می‌گیره که می‌تونه
          توی بیو یا استریمش به اشتراک بذاره تا مخاطبانش راحت ازش حمایت کنن.
        </p>

        <h2 className="font-bold text-base mt-2">چطور کار می‌کنه؟</h2>
        <ul className="flex flex-col gap-2 list-disc pr-5">
          <li><b>دونیت تومنی:</b> مستقیم و بدون واسطه از طریق درگاه پرداخت رسمی زرین‌پال به حساب بانکی خود استریمر واریز میشه. پلتفرم هیچ‌وقت این پول رو دست نمی‌گیره.</li>
          <li><b>دونیت ارزی و رمزارزی:</b> چون درگاه مستقیم برای این روش‌ها وجود نداره، مبلغ به حساب مشترک پلتفرم میره و ظرف ۲۴ ساعت، بعد از تبدیل به تومان، به حساب استریمر واریز میشه.</li>
          <li><b>ویجت‌های زنده:</b> هر استریمر می‌تونه نوار پیشرفت هدف، لیست حامیان، اعلان دونیت، و ساعت شمارش معکوس دوناتون رو مستقیم توی OBS خودش نمایش بده.</li>
        </ul>

        <h2 className="font-bold text-base mt-2">حریم خصوصی و امنیت</h2>
        <p>
          اطلاعات حساب بانکی و تسویه‌ی هر استریمر هیچ‌وقت به دونیتور نشون داده نمی‌شه. رمزهای عبور همه‌ی کاربرها
          به‌صورت رمزنگاری‌شده ذخیره میشن و هیچ‌کس (حتی مدیر پلتفرم) بهشون دسترسی مستقیم نداره.
        </p>

        <h2 className="font-bold text-base mt-2">تماس با ما</h2>
        <p>
          برای هرگونه سوال، مشکل، یا درخواست همکاری، می‌تونید از طریق ادمین پلتفرم با ما در ارتباط باشید.
        </p>
      </div>

      <Link href="/" className="btn-secondary self-center px-6 py-2.5 text-sm">بازگشت به صفحه اصلی</Link>
    </main>
  );
}
