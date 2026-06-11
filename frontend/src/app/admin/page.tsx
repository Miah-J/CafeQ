"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Cashier");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [stationNumber, setStationNumber] = useState("");
  const [department, setDepartment] = useState("");

  // Role Guard validation
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!userStr || !token) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== "Admin") {
        // Redirect non-admins to their respective homepage
        if (user.role === "Cashier") {
          router.push("/cashier");
        } else if (user.role === "ServingStaff") {
          router.push("/server");
        } else {
          router.push("/menu");
        }
      } else {
        setTimeout(() => setIsAdmin(true), 0);
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const payload: Record<string, string | undefined> = {
        email,
        password,
        fullName,
        role,
        phoneNumber: phoneNumber || undefined,
      };

      if (role === "Admin" && department) {
        payload.department = department;
      }
      if (role === "Cashier" && stationNumber) {
        payload.stationNumber = stationNumber;
      }

      const res = await fetch("http://localhost:3001/auth/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to provision user.");
      }

      setSuccess(`Successfully provisioned new ${role}: ${fullName}!`);
      // Reset form fields
      setFullName("");
      setEmail("");
      setPassword("");
      setPhoneNumber("");
      setStationNumber("");
      setDepartment("");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white font-sans">
        <p className="text-zinc-400">Verifying authorization...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#120202] via-[#080101] to-black text-white font-sans">
      {/* Sidebar / Top navigation bar */}
      <div className="w-full max-w-6xl mx-auto px-4 py-8">
        <header className="flex justify-between items-center pb-6 border-b border-white/10 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Café<span className="text-[#C59B27]">Q</span> Admin Workspace
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Strathmore University Dining Management</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/20 hover:bg-white/5 px-4 py-2 text-sm text-zinc-300 transition"
          >
            Sign Out
          </button>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main action: Provision form */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-md">
            <h2 className="text-xl font-bold mb-6 text-[#C59B27]">
              Provision Staff Account
            </h2>

            {error && (
              <div className="mb-6 rounded-lg bg-red-900/30 border border-red-500/50 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 rounded-lg bg-emerald-950/40 border border-emerald-500/50 p-4 text-sm text-emerald-200">
                {success}
              </div>
            )}

            <form onSubmit={handleProvision} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#C59B27] focus:outline-none transition appearance-none"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="ServingStaff">Serving Staff</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@strathmore.edu"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none transition"
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
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none transition"
                />
              </div>

              {role === "Cashier" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#C59B27] mb-2 font-bold">
                    Station Number (Cashier Specific)
                  </label>
                  <input
                    type="text"
                    required
                    value={stationNumber}
                    onChange={(e) => setStationNumber(e.target.value)}
                    placeholder="e.g. ST-05"
                    className="w-full rounded-lg border border-[#C59B27]/30 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none transition"
                  />
                </div>
              )}

              {role === "Admin" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#C59B27] mb-2 font-bold">
                    Department (Admin Specific)
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Finance / IT"
                    className="w-full rounded-lg border border-[#C59B27]/30 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none transition"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-[#7A1C1C] to-[#C59B27] py-3.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
              >
                {loading ? "Provisioning..." : `Provision New ${role}`}
              </button>
            </form>
          </div>

          {/* Quick info / Role rules panel */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
              <h3 className="text-base font-semibold text-[#C59B27] mb-3">
                Role Context & Rules
              </h3>
              <ul className="text-xs text-zinc-400 space-y-4">
                <li>
                  <strong className="text-white block mb-1">Cashier</strong>
                  Operates the Cashier Terminal workspace. Handles manual orders, CASH payments, and trigger-request of M-Pesa push transactions for walk-ins.
                </li>
                <li>
                  <strong className="text-white block mb-1">Serving Staff</strong>
                  Operates the lookup station at the pick-up counter. Verifies pre-order reference codes and marks orders as collected.
                </li>
                <li>
                  <strong className="text-white block mb-1">Administrator</strong>
                  Has access to this dashboard, publishes/updates the daily menu catalog, flags sold-out portions, and provisions team accounts.
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
