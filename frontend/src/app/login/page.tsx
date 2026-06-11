"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials");
      }

      // Save token and user details to localStorage
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on role
      if (data.user.role === "Cashier") {
        router.push("/cashier");
      } else {
        router.push("/menu");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#3b0a0a] via-[#1f0505] to-black p-4 text-white font-sans">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Café<span className="text-[#C59B27]">Q</span>
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Strathmore University Dining System
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 border border-red-500/50 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@strathmore.edu"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none focus:ring-1 focus:ring-[#C59B27] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none focus:ring-1 focus:ring-[#C59B27] transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-[#7A1C1C] to-[#C59B27] py-3 text-sm font-semibold text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-zinc-500">
          Kenya Data Protection Act 2019 Compliant
        </div>
      </div>
    </div>
  );
}
