"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";

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
        <div style={{ width: "100%", maxWidth: "550px", backgroundColor: "#ffffff", borderRadius: "20px", border: "1px solid rgba(114, 106, 99, 0.15)", padding: "40px", boxShadow: "0 10px 45px rgba(0,0,0,0.03)", fontFamily: "Libre Franklin", color: "#726a63" }}>
          
          <div style={{ textAlign: "center", marginBottom: "35px" }}>
            <Link href="/" className="logo" style={{ display: "inline-flex", justifyContent: "center" }}>
              CAFÉQ
            </Link>
            <p style={{ marginTop: "10px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.6)" }}>
              Student Account Registration
            </p>
          </div>

          {error && (
            <div style={{ marginBottom: "25px", padding: "12px 18px", backgroundColor: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "10px", color: "#DC2626", fontSize: "12px", fontWeight: "700" }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ marginBottom: "25px", padding: "12px 18px", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "10px", color: "#10B981", fontSize: "12px", fontWeight: "700" }}>
              {success}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label htmlFor="fullNameInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                  Full Name
                </label>
                <input
                  id="fullNameInput"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "13px", outline: "none", backgroundColor: "transparent", color: "#726a63" }}
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label htmlFor="emailInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                    Student Email Address
                  </label>
                  <input
                    id="emailInput"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane.doe@strathmore.edu"
                    style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "13px", outline: "none", backgroundColor: "transparent", color: "#726a63" }}
                  />
                </div>

                <div style={{ flex: "1 1 200px" }}>
                  <label htmlFor="studentNumberInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                    Student ID Number
                  </label>
                  <input
                    id="studentNumberInput"
                    type="text"
                    required
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value)}
                    placeholder="e.g. SU-12345"
                    style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "13px", outline: "none", backgroundColor: "transparent", color: "#726a63" }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phoneNumberInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                  Phone Number (for OTP & M-Pesa STK)
                </label>
                <input
                  id="phoneNumberInput"
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="07XXXXXXXX"
                  style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "13px", outline: "none", backgroundColor: "transparent", color: "#726a63" }}
                />
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ flex: "1 1 200px" }}>
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

                <div style={{ flex: "1 1 200px" }}>
                  <label htmlFor="confirmPasswordInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                    Confirm Password
                  </label>
                  <input
                    id="confirmPasswordInput"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "13px", outline: "none", backgroundColor: "transparent", color: "#726a63" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="slide-btn"
                style={{ width: "100%", marginTop: "10px" }}
              >
                {loading ? "Requesting Codes..." : "Send Verification Codes"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndRegister} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.8)", textAlign: "center", lineHeight: "1.6" }}>
                Please enter the 6-digit verification codes sent to your Strathmore email and registered phone number.
              </p>

              {emailPreviewUrl && (
                <div style={{ border: "1px solid #b7786b", backgroundColor: "rgba(183, 120, 107, 0.08)", padding: "15px", borderRadius: "15px", textAlign: "center" }}>
                  <p style={{ fontSize: "9px", color: "#b7786b", marginBottom: "5px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>Development Mock Mode</p>
                  <a
                    href={emailPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#b7786b", textDecoration: "underline", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "center", width: "100%" }}
                  >
                    <Mail size={14} /> Click to View Verification Email
                  </a>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label htmlFor="emailOtpInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                    Email OTP Code
                  </label>
                  <input
                    id="emailOtpInput"
                    type="text"
                    required
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "14px", fontWeight: "700", textAlign: "center", outline: "none", backgroundColor: "transparent", color: "#726a63", letterSpacing: "0.4em" }}
                  />
                </div>

                <div style={{ flex: "1 1 200px" }}>
                  <label htmlFor="phoneOtpInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                    Phone SMS Code
                  </label>
                  <input
                    id="phoneOtpInput"
                    type="text"
                    required
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    placeholder="654321"
                    maxLength={6}
                    style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "14px", fontWeight: "700", textAlign: "center", outline: "none", backgroundColor: "transparent", color: "#726a63", letterSpacing: "0.4em" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ width: "35%", background: "none", border: "1px solid rgba(114, 106, 99, 0.4)", cursor: "pointer", borderRadius: "30px", fontSize: "12px", fontWeight: "700", color: "#726a63", textTransform: "uppercase", padding: "12px 0" }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="slide-btn"
                  style={{ width: "65%" }}
                >
                  {loading ? "Verifying..." : "Verify & Sign Up"}
                </button>
              </div>
            </form>
          )}

          <div style={{ marginTop: "30px", paddingTop: "25px", borderTop: "1px solid rgba(114, 106, 99, 0.15)", textAlign: "center" }}>
            <button
              onClick={() => router.push("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#b7786b", fontWeight: "700", fontSize: "12px" }}
            >
              Already have an account? Sign In
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
