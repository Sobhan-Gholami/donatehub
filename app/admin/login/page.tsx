"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role: "admin" }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || "خطا");
    router.push("/admin/dashboard");
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm panel p-7 flex flex-col gap-4">
        <div className="flex items-center gap-2 justify-center text-xs text-muted mb-1">
          <span className="on-air-dot" />
          <span className="tracking-wide">ADMIN CONSOLE</span>
        </div>
        <h1 className="text-xl font-bold text-center mb-1">ورود ادمین</h1>
        {error && <div className="text-signal text-sm bg-signal/10 border border-signal/30 rounded-lg p-2.5" style={{ background: "rgba(255,61,113,0.08)" }}>{error}</div>}
        <input
          className="field px-4 py-2.5"
          placeholder="نام کاربری"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          className="field px-4 py-2.5"
          placeholder="رمز عبور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={loading} className="btn-primary py-2.5">
          {loading ? "..." : "ورود"}
        </button>
      </form>
    </main>
  );
}
