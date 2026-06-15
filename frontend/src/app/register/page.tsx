"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1); // 1: Details Entry, 2: OTP verification
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP Fields
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);

  // Strathmore Domain Validation Helper
  const isValidStrathmoreEmail = (emailStr: string) => {
    return emailStr.endsWith("@strathmore.edu") || emailStr.endsWith(".strathmore.edu");
  };

  // Step 1: Request Verification OTPs
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isValidStrathmoreEmail(email)) {
      setError("Registration is restricted to Strathmore University email addresses (@strathmore.edu) only.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/auth/register/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phoneNumber, studentNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to generate verification codes.");
      }

      setStep(2);
      setSuccess("Verification codes have been dispatched to your email and phone!");
      if (data.emailPreviewUrl) {
        setEmailPreviewUrl(data.emailPreviewUrl);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "OTP request failed. Please check your credentials.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTPs and Finalize Signup
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3001/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          studentNumber,
          phoneNumber,
          password,
          emailOtp,
          phoneOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration verification failed.");
      }

      setSuccess("Successfully verified and registered!");

      // Auto login
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      setTimeout(() => {
        router.push("/menu");
      }, 1500);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Verification failed. Check the codes and try again.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-ink font-sans">
      <div className="w-full max-w-lg rounded-[10px] border border-secondary/20 bg-white p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-extrabold tracking-tight text-primary hover:opacity-90 transition">
            CaféQ
          </Link>
          <p className="mt-2 text-xs text-secondary font-medium uppercase tracking-wider">
            Student Account Registration
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-[10px] bg-status-sold-out/10 border border-status-sold-out/30 p-3.5 text-xs text-status-sold-out font-bold">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-600 font-bold">
            {success}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                  Student Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.doe@strathmore.edu"
                  className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                  Student ID Number
                </label>
                <input
                  type="text"
                  required
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  placeholder="e.g. SU-12345"
                  className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                Phone Number (for OTP & M-Pesa STK)
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="07XXXXXXXX"
                className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white shadow-sm hover:bg-accent hover:text-ink transition active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Requesting Codes..." : "Send Verification Codes"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndRegister} className="space-y-5">
            <p className="text-xs text-secondary text-center leading-relaxed">
              Please enter the 6-digit verification codes sent to your Strathmore email and registered phone number.
            </p>

            {emailPreviewUrl && (
              <div className="rounded-[10px] border border-accent/30 bg-accent/10 p-3.5 text-center">
                <p className="text-[10px] text-[#A6751E] mb-1 font-bold uppercase tracking-wider">Development Mock Mode</p>
                <a
                  href={emailPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs font-bold block"
                >
                  ✉️ Click to View Verification Email
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                  Email Verification Code
                </label>
                <input
                  type="text"
                  required
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full text-center rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-base font-bold tracking-widest text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                  Phone SMS Code
                </label>
                <input
                  type="text"
                  required
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  placeholder="654321"
                  maxLength={6}
                  className="w-full text-center rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-base font-bold tracking-widest text-ink placeholder-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 rounded-[10px] border border-secondary/30 hover:bg-secondary/5 py-3 text-sm font-bold text-secondary transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 rounded-[10px] bg-primary py-3 text-sm font-bold text-white shadow-sm hover:bg-accent hover:text-ink transition active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Sign Up"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-secondary/15 text-center">
          <button
            onClick={() => router.push("/login")}
            className="text-xs text-primary hover:text-accent font-bold transition"
          >
            Already have an account? Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
