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
    <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      
      {/* ANNOUNCEMENT BAR (MARQUEE) */}
      <div className="announcement-bar">
        <div className="announcement-bar__content">
          <span className="announcement-bar__item">Fast Campus Handovers</span>
          <span className="announcement-bar__item">Skip The Cafeteria Queue</span>
          <span className="announcement-bar__item">Pay Securely via M-Pesa STK Push</span>
          <span className="announcement-bar__item">Live Portion Stock Tracking</span>
          {/* Repeated for marquee loop */}
          <span className="announcement-bar__item">Fast Campus Handovers</span>
          <span className="announcement-bar__item">Skip The Cafeteria Queue</span>
          <span className="announcement-bar__item">Pay Securely via M-Pesa STK Push</span>
          <span className="announcement-bar__item">Live Portion Stock Tracking</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ width: "100%", maxWidth: "450px", backgroundColor: "#ffffff", borderRadius: "20px", border: "1px solid rgba(114, 106, 99, 0.15)", padding: "40px", boxShadow: "0 10px 45px rgba(0,0,0,0.03)", fontFamily: "Libre Franklin", color: "#726a63" }}>
          
          <div style={{ textAlign: "center", marginBottom: "35px" }}>
            <Link href="/" className="logo" style={{ display: "inline-flex", justifyContent: "center" }}>
              CAFÉQ
            </Link>
            <p style={{ marginTop: "10px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.6)" }}>
              Strathmore Cafeteria Portal
            </p>
          </div>

          {error && (
            <div style={{ marginBottom: "25px", padding: "12px 18px", backgroundColor: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "10px", color: "#DC2626", fontSize: "12px", fontWeight: "700" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <label htmlFor="emailInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                Email Address
              </label>
              <input
                id="emailInput"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. student@strathmore.edu"
                style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "13px", outline: "none", backgroundColor: "transparent", color: "#726a63" }}
              />
            </div>

            <div>
              <label htmlFor="passwordInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                Password
              </label>
              <input
                id="passwordInput"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "13px", outline: "none", backgroundColor: "transparent", color: "#726a63" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="slide-btn"
              style={{ width: "100%", marginTop: "10px" }}
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: "30px", textAlign: "center", fontSize: "12px", borderTop: "1px solid rgba(114, 106, 99, 0.15)", paddingTop: "25px" }}>
            <span style={{ color: "rgba(114, 106, 99, 0.7)" }}>Don&apos;t have an account? </span>
            <button
              onClick={() => router.push("/register")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#b7786b", fontWeight: "700" }}
            >
              Register here
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
