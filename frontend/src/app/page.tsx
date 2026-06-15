"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("Student");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      setIsLoggedIn(true);
      try {
        const parsed = JSON.parse(storedUser) as User;
        setUserRole(parsed.role);
      } catch {
        // Fallback
      }
    }
  }, []);

  const getDashboardLink = () => {
    if (userRole === "Cashier") return "/cashier";
    if (userRole === "ServingStaff") return "/server";
    if (userRole === "Admin") return "/admin";
    return "/menu";
  };

  return (
    <div className="min-h-screen bg-background text-ink font-sans flex flex-col justify-between selection:bg-accent/30">
      {/* Top Bar */}
      <header className="border-b border-secondary/20 bg-white/50 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight text-primary hover:opacity-90 transition">
            CaféQ
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href={getDashboardLink()}
                className="rounded-[10px] bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-accent hover:text-ink transition active:scale-95"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-[10px] border border-secondary/30 px-5 py-2 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="rounded-[10px] bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-accent hover:text-ink transition active:scale-95"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col justify-center items-center px-6 py-16 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-ink mb-6 leading-tight max-w-3xl">
          Pre-order your cafeteria meals, <span className="text-primary">skip the queue</span>
        </h1>
        <p className="text-base sm:text-lg text-secondary max-w-2xl mb-10 leading-relaxed">
          CaféQ connects you to Strathmore Dining. Order your lunch in seconds, pay securely with M-Pesa, and pick it up instantly at the counter with your unique code.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-20 w-full sm:w-auto">
          {isLoggedIn ? (
            <Link
              href={getDashboardLink()}
              className="rounded-[10px] bg-primary px-8 py-3.5 text-sm font-bold text-white hover:bg-accent hover:text-ink transition shadow-sm text-center"
            >
              Access Menu Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-[10px] bg-primary px-8 py-3.5 text-sm font-bold text-white hover:bg-accent hover:text-ink transition shadow-sm text-center"
              >
                Browse Daily Menu
              </Link>
              <Link
                href="/register"
                className="rounded-[10px] border border-secondary/30 px-8 py-3.5 text-sm font-bold text-secondary hover:bg-secondary/5 transition text-center"
              >
                Create Account
              </Link>
            </>
          )}
        </div>

        {/* Features Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-left">
          {/* Card 1 */}
          <div className="bg-white border border-secondary/10 p-6 rounded-[10px] shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col justify-between h-full">
            <div>
              <div className="h-10 w-10 bg-primary/10 rounded-[10px] flex items-center justify-center mb-4">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="font-bold text-ink text-base mb-2">Live Stock Tracking</h3>
              <p className="text-secondary text-xs leading-relaxed">
                Portion counters update in real time. Know exactly what is available and never pay for a dish that is already sold out.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-secondary/10 p-6 rounded-[10px] shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col justify-between h-full">
            <div>
              <div className="h-10 w-10 bg-primary/10 rounded-[10px] flex items-center justify-center mb-4">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-ink text-base mb-2">Instant M-Pesa Payments</h3>
              <p className="text-secondary text-xs leading-relaxed">
                Approve your checkout on your phone using automated Daraja STK Push prompts. It is fast, secure, and fully cashless.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-secondary/10 p-6 rounded-[10px] shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col justify-between h-full">
            <div>
              <div className="h-10 w-10 bg-primary/10 rounded-[10px] flex items-center justify-center mb-4">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0a8 8 0 11-16 0 8 8 0 0116 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-ink text-base mb-2">Fast Counter Pickups</h3>
              <p className="text-secondary text-xs leading-relaxed">
                Receive a pickup reference number instantly on screen and via SMS. Present it at the counter and take your food in seconds.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-secondary/10 bg-white/20 py-8 text-center text-xs text-secondary px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} CaféQ. Strathmore University Cafeteria.</p>
          <div className="flex gap-4">
            <span className="text-secondary/70">Kenya Data Protection Act 2019 Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
