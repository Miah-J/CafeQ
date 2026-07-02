"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";


interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  dietaryTags: string[] | null;
  preparedQuantity: number;
  liveQuantity: number;
  isSoldOut: boolean;
  imageUrl?: string | null;
}

interface Menu {
  id: string;
  publishDate: string;
  isActive: boolean;
  dishes: Dish[];
}

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("Student");

  // Ref for horizontal scroll container
  const howItWorksSectionRef = useRef<HTMLDivElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const storedUser = sessionStorage.getItem("user");
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

  // IntersectionObserver for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -50px 0px" }
    );

    const animatedElements = document.querySelectorAll(".animate-on-scroll");
    animatedElements.forEach((el) => observer.observe(el));

    return () => {
      animatedElements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  // Smooth side-scroll on vertical-scroll for "How CaféQ Works"
  useEffect(() => {
    const handleScrollHorizontal = () => {
      if (!howItWorksSectionRef.current || !timelineTrackRef.current) return;

      const rect = howItWorksSectionRef.current.getBoundingClientRect();
      const containerHeight = rect.height;
      const topOffset = rect.top;

      const windowHeight = window.innerHeight;
      const totalScrollable = containerHeight - windowHeight;

      // Calculate scroll progress percentage inside the sticky wrapper's parent container
      // It starts when the top of container matches top of viewport (topOffset <= 0)
      const scrolled = -topOffset;
      let progress = scrolled / totalScrollable;
      progress = Math.max(0, Math.min(1, progress));

      const trackWidth = timelineTrackRef.current.scrollWidth;
      const viewportWidth = window.innerWidth;

      // Translate only if the track is wider than the screen
      const maxTranslate = Math.max(0, trackWidth - viewportWidth + (window.innerWidth * 0.15));
      const translateAmount = progress * maxTranslate;

      timelineTrackRef.current.style.transform = `translate3d(${-translateAmount}px, 0, 0)`;
    };

    window.addEventListener("scroll", handleScrollHorizontal);
    window.addEventListener("resize", handleScrollHorizontal);
    handleScrollHorizontal();

    return () => {
      window.removeEventListener("scroll", handleScrollHorizontal);
      window.removeEventListener("resize", handleScrollHorizontal);
    };
  }, []);

  const getDashboardLink = () => {
    if (userRole === "Cashier") return "/cashier";
    if (userRole === "ServingStaff") return "/server";
    if (userRole === "Admin") return "/admin";
    return "/menu";
  };

  return (
    <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* HEADER */}
      <header className="header-wrapper">
        <div className="header-top">
          <Link href="/" className="logo">CAFÉQ</Link>

          <div className="header-utilities">
            <span className="small-hide" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Strathmore Cafeteria
            </span>

            {isLoggedIn ? (
              <Link href={getDashboardLink()} className="slide-btn" style={{ padding: "10px 24px", fontSize: "11px" }}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="nav-link" style={{ fontSize: "12px", fontWeight: "700" }}>
                  Sign In
                </Link>
                <Link href="/register" className="slide-btn" style={{ padding: "10px 24px", fontSize: "11px" }}>
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero-text-section">
        <div className="hero-text-content">
          <span className="slide-caption">Welcome to CaféQ</span>
          <h1 className="hero-text-title animate-on-scroll">Pre-order Lunch in Seconds</h1>
          <p className="hero-text-desc animate-on-scroll">
            CaféQ is a cafeteria pre-ordering system built for Strathmore University students.
            Browse the daily menu, place your order online, pay securely via M-Pesa STK Push,
            and skip the queue — just present your unique reference code at the counter for instant pickup.
          </p>
          <div className="hero-text-buttons animate-on-scroll">
            <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="slide-btn" style={{ display: "inline-block", textAlign: "center" }}>
              Browse Daily Menu
            </Link>
            <Link href="/register" className="slide-btn slide-btn--outline" style={{ display: "inline-block", textAlign: "center" }}>
              Create Account
            </Link>
          </div>
        </div>

        {/* LIVE SYSTEM STATISTICS */}
        <div className="stats-bar">
          <div className="stats-container">
            <div className="stat-card">
              <span className="stat-number">&lt; 1 minute</span>
              <span className="stat-label">Average Pickup Time</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-card">
              <span className="stat-number">10 pts</span>
              <span className="stat-label">Per KES 100 Spent</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-card">
              <span className="stat-number">100%</span>
              <span className="stat-label">Secure M-Pesa STK</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-card">
              <span className="stat-number">Live</span>
              <span className="stat-label">Portion Tracking</span>
            </div>
          </div>
        </div>
      </section>

      {/* THE CAFÉQ STANDARD */}
      <section className="standard-section">
        <div className="standard-grid">

          <div className="standard-item animate-on-scroll">
            <div className="standard-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h4 className="standard-title">Live Stock Tracking</h4>
            <p className="standard-desc">Portion counters update in real time. Know what is available.</p>
          </div>

          <div className="standard-item animate-on-scroll">
            <div className="standard-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h4 className="standard-title">M-Pesa Checkout</h4>
            <p className="standard-desc">Approve payments instantly on your phone via automated STK Prompts.</p>
          </div>

          <div className="standard-item animate-on-scroll">
            <div className="standard-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h4 className="standard-title">KenyaSMS Alerts</h4>
            <p className="standard-desc">Get unique pick-up codes sent immediately to your phone.</p>
          </div>

          <div className="standard-item animate-on-scroll">
            <div className="standard-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h4 className="standard-title">Speedy Handover</h4>
            <p className="standard-desc">Present your reference code and pick up your hot food in seconds.</p>
          </div>

        </div>
      </section>



      {/* HOW IT WORKS SECTION (HORIZONTAL PINNED SCROLL) */}
      <section className="how-it-works-scroll-container" ref={howItWorksSectionRef}>
        <div className="how-it-works-sticky-wrapper">
          <div className="section-header animate-on-scroll">
            <span className="slide-caption">Step-By-Step Process</span>
            <h2 className="section-title">How CaféQ Works</h2>
          </div>

          <div className="timeline-horizontal-viewport">
            <div className="timeline-horizontal-track" ref={timelineTrackRef}>

              <div className="timeline-card">
                <div className="timeline-number">01</div>
                <h4 className="timeline-title">Browse & Reserve</h4>
                <p className="timeline-desc">Check out today's live menu availability. Select your meal portions and lock them down before they sell out.</p>
              </div>

              <div className="timeline-card">
                <div className="timeline-number">02</div>
                <h4 className="timeline-title">Pay Cashless</h4>
                <p className="timeline-desc">Checkout and receive an instant M-Pesa STK push. Enter your PIN on your phone to complete payment safely.</p>
              </div>

              <div className="timeline-card">
                <div className="timeline-number">03</div>
                <h4 className="timeline-title">Get SMS Alert</h4>
                <p className="timeline-desc">Our integrated SMS platform drops a secure 6-character alphanumeric pickup code directly to your phone.</p>
              </div>

              <div className="timeline-card">
                <div className="timeline-number">04</div>
                <h4 className="timeline-title">Fast Pickup</h4>
                <p className="timeline-desc">Walk up to the counter, show your code to the serving staff, and grab your steaming hot lunch without waiting.</p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* LOYALTY & WALLET BENEFITS */}
      <section className="benefits-section">
        <div className="section-header animate-on-scroll">
          <span className="slide-caption">Smart Diner Rewards</span>
          <h2 className="section-title">Wallet & Loyalty Perks</h2>
        </div>
        <div className="benefits-grid">
          <div className="benefit-card animate-on-scroll">
            <div className="benefit-badge">CafeQ Loyalty</div>
            <h3 className="benefit-title">Student Loyalty Tiers</h3>
            <p className="benefit-desc">
              Earn points with every bite! Collect points on every order to automatically level up through Bronze, Silver, and Gold status levels. Higher tiers unlock early menu access and priority collection speed.
            </p>
            <div className="benefit-highlight">1 Point Earned for every KES 10 spent</div>
          </div>
          <div className="benefit-card animate-on-scroll">
            <div className="benefit-badge">Cashless Wallet</div>
            <h3 className="benefit-title">Integrated Digital Wallet</h3>
            <p className="benefit-desc">
              Keep your dining funds in one place. Pre-load your digital wallet with M-Pesa for instant one-click cafeteria checkouts, bypass processing network delays, and receive instant cash refunds.
            </p>
            <div className="benefit-highlight">Zero checkout fees & instant refunds</div>
          </div>
        </div>
      </section>

      {/* SKIP THE LINE BANNER */}
      <section className="promo-section animate-on-scroll">
        <div className="promo-banner">
          <div className="promo-content">
            <span className="promo-tagline">Speedy Counter Handover</span>
            <h2 className="promo-title">Skip the Canteen Queue</h2>
            <p className="promo-desc">Collect your food in seconds at the counter by presenting your unique reference code. Cashiers and serving staff verify and dispense instantly. Fully cashless, zero delay.</p>
            <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="promo-btn" style={{ display: "inline-block", textAlign: "center", textDecoration: "none" }}>
              Get Started Now
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <h2 className="footer-title">Pre-order. Pay. Pick Up.</h2>
          </div>

          <div className="footer-column">
            <h3 className="footer-heading">Services</h3>
            <ul className="footer-links">
              <li><Link href={isLoggedIn ? getDashboardLink() : "/login"}>Daily Menu</Link></li>
              <li><Link href="/register">Student Signup</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>&copy; {new Date().getFullYear()} CaféQ Strathmore Dining. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}
