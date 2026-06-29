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

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("Student");
  
  // Slide & UI States
  const [currentSlide, setCurrentSlide] = useState(0);
  const [cookieDismissed, setCookieDismissed] = useState(false);
  
  // Carousel Refs
  const exclusivesViewportRef = useRef<HTMLDivElement>(null);
  const featuredViewportRef = useRef<HTMLDivElement>(null);

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

    // Check if cookies accepted historically
    const cookiesAccepted = localStorage.getItem("cookies_accepted");
    if (cookiesAccepted === "true") {
      setCookieDismissed(true);
    }
  }, []);

  // Autoplay Slider logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 2);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const getDashboardLink = () => {
    if (userRole === "Cashier") return "/cashier";
    if (userRole === "ServingStaff") return "/server";
    if (userRole === "Admin") return "/admin";
    return "/menu";
  };

  const handleScroll = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    if (ref.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const acceptCookies = () => {
    localStorage.setItem("cookies_accepted", "true");
    setCookieDismissed(true);
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

      {/* HERO SLIDER */}
      <section className="hero-slider">
        <div className="slider-track" style={{ transform: `translate3d(-${currentSlide * 50}%, 0, 0)` }}>
          
          {/* Slide 1 */}
          <div className="slide slide-1">
            <div className="slide-content">
              <span className="slide-caption">Skip the Cafeteria Line</span>
              <h2 className="slide-title">Pre-order Lunch in Seconds</h2>
              <p className="slide-desc">Order your favorite meals online from Strathmore Dining, pay securely with M-Pesa, and pick up instantly at the counter.</p>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="slide-btn" style={{ display: "inline-block", textAlign: "center" }}>
                Browse Daily Menu
              </Link>
            </div>
          </div>
          
          {/* Slide 2 */}
          <div className="slide slide-2">
            <div className="slide-content">
              <span className="slide-caption">Fast Cashless Checkout</span>
              <h2 className="slide-title">Seamless M-Pesa Payments</h2>
              <p className="slide-desc">Approve your transactions directly on your mobile device via Safaricom M-Pesa STK prompts and get instant confirmations.</p>
              <Link href="/register" className="slide-btn" style={{ display: "inline-block", textAlign: "center" }}>
                Register Account
              </Link>
            </div>
          </div>
          
        </div>
        
        {/* Slider Controls */}
        <button 
          className="slider-arrow slider-arrow--prev" 
          onClick={() => setCurrentSlide((prev) => (prev - 1 + 2) % 2)} 
          aria-label="Previous slide"
        >
          <svg viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <button 
          className="slider-arrow slider-arrow--next" 
          onClick={() => setCurrentSlide((prev) => (prev + 1) % 2)} 
          aria-label="Next slide"
        >
          <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
        </button>
        
        <div className="slider-dots">
          <div className={`slider-dot ${currentSlide === 0 ? "active" : ""}`} onClick={() => setCurrentSlide(0)}></div>
          <div className={`slider-dot ${currentSlide === 1 ? "active" : ""}`} onClick={() => setCurrentSlide(1)}></div>
        </div>
      </section>

      {/* THE CAFÉQ STANDARD */}
      <section className="standard-section">
        <div className="standard-grid">
          
          <div className="standard-item">
            <div className="standard-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h4 className="standard-title">Live Stock Tracking</h4>
            <p className="standard-desc">Portion counters update in real time. Know what is available.</p>
          </div>
          
          <div className="standard-item">
            <div className="standard-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h4 className="standard-title">M-Pesa Checkout</h4>
            <p className="standard-desc">Approve payments instantly on your phone via automated STK Prompts.</p>
          </div>
          
          <div className="standard-item">
            <div className="standard-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h4 className="standard-title">KenyaSMS Alerts</h4>
            <p className="standard-desc">Get unique pick-up codes sent immediately to your phone.</p>
          </div>
          
          <div className="standard-item">
            <div className="standard-icon-wrapper">
              <svg viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h4 className="standard-title">Speedy Handover</h4>
            <p className="standard-desc">Present your reference code and pick up your hot food in seconds.</p>
          </div>
          
        </div>
      </section>

      {/* CHEF'S SPECIALS CAROUSEL */}
      <section className="carousel-section">
        <div className="carousel-header">
          <div className="carousel-title-group">
            <span className="carousel-tagline">Unique Selection</span>
            <h3 className="carousel-heading">Chef's Specials</h3>
          </div>
          
          <div className="carousel-nav-buttons">
            <button className="carousel-nav-btn" onClick={() => handleScroll(exclusivesViewportRef, "left")} aria-label="Previous products">
              <svg viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button className="carousel-nav-btn" onClick={() => handleScroll(exclusivesViewportRef, "right")} aria-label="Next products">
              <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
        
        <div className="carousel-viewport" ref={exclusivesViewportRef}>
          
          {/* Item 1 */}
          <div className="carousel-item">
            <div className="card__inner">
              <div className="card__media">
                <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" className="front-img" alt="Pilau Beef" />
                <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400" className="hover-img" alt="Pilau Beef closeup" />
              </div>
            </div>
            <div className="card-info">
              <span className="product-brand">Swahili Kitchen</span>
              <h3 className="product-title">Fragrant Beef Pilau (Prepared with pure spices)</h3>
              <span className="product-price">KES 250.00</span>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="cart-action-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Order Now
              </Link>
            </div>
          </div>
          
          {/* Item 2 */}
          <div className="carousel-item">
            <div className="card__inner">
              <div className="card__media">
                <img src="https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&q=80&w=400" className="front-img" alt="Grilled Chicken" />
                <img src="https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&q=80&w=400" className="hover-img" alt="Grilled Chicken closeup" />
              </div>
            </div>
            <div className="card-info">
              <span className="product-brand">Flame Grill</span>
              <h3 className="product-title">Quarter Grilled Chicken (Served with Steamed Rice)</h3>
              <span className="product-price">KES 350.00</span>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="cart-action-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Order Now
              </Link>
            </div>
          </div>
          
          {/* Item 3 */}
          <div className="carousel-item">
            <div className="card__inner">
              <div className="card__media">
                <img src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=400" className="front-img" alt="Beef Stew" />
                <img src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=400" className="hover-img" alt="Beef Stew closeup" />
              </div>
            </div>
            <div className="card-info">
              <span className="product-brand">Classic Stew</span>
              <h3 className="product-title">Slow Cooked Beef Stew (In a rich coconut curry)</h3>
              <span className="product-price">KES 220.00</span>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="cart-action-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Order Now
              </Link>
            </div>
          </div>
          
          {/* Item 4 */}
          <div className="carousel-item">
            <div className="card__inner">
              <div className="card__media">
                <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400" className="front-img" alt="Fish Fry" />
                <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400" className="hover-img" alt="Fish Fry closeup" />
              </div>
            </div>
            <div className="card-info">
              <span className="product-brand">Lake View</span>
              <h3 className="product-title">Lake Victoria Fish Wet Fry (Seasoned with herbs)</h3>
              <span className="product-price">KES 380.00</span>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="cart-action-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Order Now
              </Link>
            </div>
          </div>
          
        </div>
      </section>

      {/* DESSERTS & FAVOURITES (GRID CATEGORIES) */}
      <section className="favourites-section">
        <div className="favourites-heading-group">
          <span className="carousel-tagline">Popular Categories</span>
          <h3 className="carousel-heading">Canteen Favourites</h3>
        </div>
        
        <div className="favourites-grid">
          {/* Card 1 */}
          <div className="favourites-card fav-card-1" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400')" }}>
            <div className="favourites-content">
              <h4 className="favourites-card-title">Lunch Specials</h4>
              <p className="favourites-card-desc">Curation of daily hot meals, stews, and traditional specialties.</p>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="favourites-card-btn">
                Browse Meals
              </Link>
            </div>
          </div>
          
          {/* Card 2 */}
          <div className="favourites-card fav-card-2" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&q=80&w=400')" }}>
            <div className="favourites-content">
              <h4 className="favourites-card-title">Breakfast Delights</h4>
              <p className="favourites-card-desc">Start your morning with fresh tea, custom mandazis, and chapatis.</p>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="favourites-card-btn">
                See Breakfast
              </Link>
            </div>
          </div>
          
          {/* Card 3 */}
          <div className="favourites-card fav-card-3" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80&w=400')" }}>
            <div className="favourites-content">
              <h4 className="favourites-card-title">Healthy & Fresh</h4>
              <p className="favourites-card-desc">Nutrient-dense vegetables, fruit juices, and custom healthy salads.</p>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="favourites-card-btn">
                See Salads
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS CAROUSEL */}
      <section className="carousel-section">
        <div className="carousel-header">
          <div className="carousel-title-group">
            <span className="carousel-tagline">Student Favorites</span>
            <h3 className="carousel-heading">Featured Combos</h3>
          </div>
          
          <div className="carousel-nav-buttons">
            <button className="carousel-nav-btn" onClick={() => handleScroll(featuredViewportRef, "left")} aria-label="Previous products">
              <svg viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button className="carousel-nav-btn" onClick={() => handleScroll(featuredViewportRef, "right")} aria-label="Next products">
              <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
        
        <div className="carousel-viewport" ref={featuredViewportRef}>
          
          {/* Item 1 */}
          <div className="carousel-item">
            <div className="card__inner">
              <div className="card__media">
                <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=400" className="front-img" alt="Chapati Combo" />
                <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=400" className="hover-img" alt="Chapati Combo closeup" />
              </div>
            </div>
            <div className="card-info">
              <span className="product-brand">Comfort Food</span>
              <h3 className="product-title">Chapati Madondo (Yellow beans stew combo)</h3>
              <span className="product-price">KES 120.00</span>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="cart-action-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Order Now
              </Link>
            </div>
          </div>
          
          {/* Item 2 */}
          <div className="carousel-item">
            <div className="card__inner">
              <div className="card__media">
                <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400" className="front-img" alt="Githeri special" />
                <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400" className="hover-img" alt="Githeri special closeup" />
              </div>
            </div>
            <div className="card-info">
              <span className="product-brand">Traditional</span>
              <h3 className="product-title">Githeri Special (Soft boiled maize & beans)</h3>
              <span className="product-price">KES 100.00</span>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="cart-action-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Order Now
              </Link>
            </div>
          </div>
          
          {/* Item 3 */}
          <div className="carousel-item">
            <div className="card__inner">
              <div className="card__media">
                <img src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80&w=400" className="front-img" alt="Fruit Salad" />
                <img src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80&w=400" className="hover-img" alt="Fruit Salad closeup" />
              </div>
            </div>
            <div className="card-info">
              <span className="product-brand">Dessert</span>
              <h3 className="product-title">Premium Fruit Salad (Mixed organic fruits)</h3>
              <span className="product-price">KES 150.00</span>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="cart-action-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Order Now
              </Link>
            </div>
          </div>
          
          {/* Item 4 */}
          <div className="carousel-item">
            <div className="card__inner">
              <div className="card__media">
                <img src="https://images.unsplash.com/photo-1501200156827-024c885f8fc3?auto=format&fit=crop&q=80&w=400" className="front-img" alt="Ugali Beef" />
                <img src="https://images.unsplash.com/photo-1501200156827-024c885f8fc3?auto=format&fit=crop&q=80&w=400" className="hover-img" alt="Ugali Beef closeup" />
              </div>
            </div>
            <div className="card-info">
              <span className="product-brand">Local Favorite</span>
              <h3 className="product-title">White Ugali & Beef (Served with local greens)</h3>
              <span className="product-price">KES 200.00</span>
              <Link href={isLoggedIn ? getDashboardLink() : "/login"} className="cart-action-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                Order Now
              </Link>
            </div>
          </div>
          
        </div>
      </section>

      {/* SKIP THE LINE BANNER */}
      <section className="promo-section">
        <div className="promo-banner">
          <div className="promo-image" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800')" }}></div>
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

      {/* PARTNERS */}
      <section className="partners-section">
        <div className="partners-container">
          <div className="partner-logo">Strathmore</div>
          <div className="partner-logo">M-Pesa</div>
          <div className="partner-logo">KenyaSMS</div>
          <div className="partner-logo">CafeQ Pay</div>
          <div className="partner-logo">Daraja API</div>
        </div>
      </section>

      {/* JOURNAL SECTION */}
      <section className="journal-section">
        <div className="journal-header">
          <span className="carousel-tagline">Articles & Insights</span>
          <h3 className="carousel-heading" style={{ marginTop: "5px" }}>CaféQ Journal</h3>
        </div>
        
        <div className="journal-grid">
          {/* Article 1 */}
          <div className="journal-card">
            <div className="journal-image-wrapper">
              <img src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400" alt="Nutrition hacks" />
            </div>
            <span className="journal-date">29 June 2026</span>
            <h4 className="journal-title">Eating Healthy on Campus: Budget Canteen Tips</h4>
            <p className="journal-excerpt">Discover how to find nutrient-dense meals at Strathmore Dining without breaking the bank, balancing proteins and fresh greens.</p>
            <span className="journal-read-more">Read Article</span>
          </div>
          
          {/* Article 2 */}
          <div className="journal-card">
            <div className="journal-image-wrapper">
              <img src="https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&q=80&w=400" alt="Food waste" />
            </div>
            <span className="journal-date">24 June 2026</span>
            <h4 className="journal-title">Reducing Campus Food Waste Through Pre-Ordering</h4>
            <p className="journal-excerpt">How pre-ordering lunch via CafeQ helps the kitchen prepare exact portions, minimizing environmental footprints and food waste.</p>
            <span className="journal-read-more">Read Article</span>
          </div>
          
          {/* Article 3 */}
          <div className="journal-card">
            <div className="journal-image-wrapper">
              <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400" alt="Cashless dining" />
            </div>
            <span className="journal-date">19 June 2026</span>
            <h4 className="journal-title">The Rise of Cashless Dining in University Cafeterias</h4>
            <p className="journal-excerpt">Exploring how digital wallets and automated SMS alerts streamline student lunch hour queues, improving dining efficiency.</p>
            <span className="journal-read-more">Read Article</span>
          </div>
        </div>
      </section>

      {/* COOKIE CONSENT BANNER */}
      {!cookieDismissed && (
        <div className="cookie-banner">
          <p className="cookie-text">
            This website uses cookies to supplement a balanced diet and provide a much-deserved reward to the senses after consuming campus meals. Accepting our cookies is optional but highly recommended. See our <a href="#" style={{ textDecoration: "underline" }}>cookie policy</a>.
          </p>
          <div className="cookie-actions">
            <span className="cookie-btn-link" onClick={() => alert("Preferences Panel loaded.")}>Preferences</span>
            <button className="cookie-btn-primary" onClick={acceptCookies}>Accept All</button>
          </div>
        </div>
      )}

      {/* WHATSAPP FLOATER */}
      <div 
        className="whatsapp-float" 
        onClick={() => window.open("https://wa.me/254712345678", "_blank")} 
        aria-label="Contact us on WhatsApp"
      >
        <svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.453L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.586 2.016 14.12 1.01 11.999 1.01 6.562 1.01 2.135 5.378 2.131 10.809c-.001 1.706.453 3.376 1.314 4.851l-.995 3.636 3.72-.942z"/></svg>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <h2 className="footer-title">Pre-order. Pay. Pick Up.</h2>
            <div className="social-links">
              <a href="#" className="social-icon" aria-label="Instagram">
                <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="#" className="social-icon" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.453L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.586 2.016 14.12 1.01 11.999 1.01 6.562 1.01 2.135 5.378 2.131 10.809c-.001 1.706.453 3.376 1.314 4.851l-.995 3.636 3.72-.942z"/></svg>
              </a>
            </div>
          </div>
          
          <div className="footer-column">
            <h3 className="footer-heading">Services</h3>
            <ul className="footer-links">
              <li><Link href={isLoggedIn ? getDashboardLink() : "/login"}>Daily Menu</Link></li>
              <li><Link href="/register">Student Signup</Link></li>
            </ul>
          </div>
          
          <div className="footer-column">
            <h3 className="footer-heading">Support</h3>
            <ul className="footer-links">
              <li><a href="#">Strathmore ICT</a></li>
              <li><a href="#">Contact Dining</a></li>
            </ul>
          </div>
          
          <div className="footer-column">
            <h3 className="footer-heading">Compliance</h3>
            <ul className="footer-links">
              <li><a href="#">Kenya Data Protection Act</a></li>
              <li><a href="#">Terms of Use</a></li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div>&copy; {new Date().getFullYear()} CaféQ Strathmore Dining. All rights reserved.</div>
          <div className="footer-legal">
            <a href="#">Terms & Conditions</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Cookie Policy</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
