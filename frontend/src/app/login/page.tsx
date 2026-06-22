"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
      } else if (data.user.role === "ServingStaff") {
        router.push("/server");
      } else if (data.user.role === "Admin") {
        router.push("/admin");
      } else if (data.user.role === "KitchenStaff") {
        router.push("/kitchen");
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-ink font-sans">
      <div className="w-full max-w-md rounded-[10px] border border-secondary/20 bg-white p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-extrabold tracking-tight text-primary hover:opacity-90 transition">
            CaféQ
          </Link>
          <p className="mt-2 text-xs text-secondary font-medium uppercase tracking-wider">
            Strathmore University Cafeteria System
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-[10px] bg-status-sold-out/10 border border-status-sold-out/30 p-3.5 text-xs text-status-sold-out font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@strathmore.edu"
              className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white shadow-sm hover:bg-accent hover:text-ink transition active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs border-t border-secondary/15 pt-6">
          <span className="text-secondary font-medium">Don&apos;t have an account? </span>
          <button
            onClick={() => router.push("/register")}
            className="text-primary hover:text-accent font-bold transition"
          >
            Register here
          </button>
        </div>


      </div>
    </div>
  );
}
