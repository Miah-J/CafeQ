"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  UtensilsCrossed, 
  AlertTriangle, 
  Info 
} from "lucide-react";


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

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderSuccessDetail {
  id: string;
  totalAmount: number;
  status: string;
  referenceCode?: string | null;
  items: Array<{
    id: string;
    dishId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

const DIETARY_FILTERS = ["Halal", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"];

export default function MenuBrowsing() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<string>("featured");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  const getDashboardLink = () => {
    if (!user) return "/login";
    if (user.role === "Cashier") return "/cashier";
    if (user.role === "ServingStaff" || user.role === "Server") return "/server";
    if (user.role === "Admin") return "/admin";
    return "/menu";
  };


  // Cart and checkout states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccessDetail | null>(null);

  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"IDLE" | "PENDING" | "SUCCESS" | "FAILED" | "TIMEOUT">("IDLE");
  const [paymentError, setPaymentError] = useState("");
  const [mpesaReceipt, setMpesaReceipt] = useState("");
  const [pollIntervalId, setPollIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

  // Wallet states
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [useWallet, setUseWallet] = useState(true);

  // Wallet Top-Up states
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpStatus, setTopUpStatus] = useState<"IDLE" | "PENDING" | "SUCCESS" | "FAILED" | "TIMEOUT">("IDLE");
  const [topUpError, setTopUpError] = useState("");
  const [topUpReceipt, setTopUpReceipt] = useState("");
  const [topUpPollIntervalId, setTopUpPollIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

  // Loyalty states
  const [loyaltyStatus, setLoyaltyStatus] = useState<{
    pointsBalance: number;
    status: string;
    tier: string;
    nextTier: string;
    progressToNextTier: number;
    redemptionThreshold: number;
    isEligible: boolean;
  } | null>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<any[]>([]);
  const [pointsToRedeemInput, setPointsToRedeemInput] = useState("");
  const [redeemError, setRedeemError] = useState("");

  // Drawer & Overlay UI States
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [loyaltyDrawerOpen, setLoyaltyDrawerOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [cookieDismissed, setCookieDismissed] = useState(false);

  const fetchWalletBalance = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("http://localhost:3001/payments/wallet/balance", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(Number(data.balance));
      }
    } catch (err) {
      console.error("Failed to fetch wallet balance:", err);
    }
  };

  const fetchLoyaltyStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("http://localhost:3001/loyalty/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLoyaltyStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch loyalty status:", err);
    }
  };

  const fetchLoyaltyHistory = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("http://localhost:3001/loyalty/history", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLoyaltyHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch loyalty history:", err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser) as User;
    setUser(parsedUser);

    void fetchWalletBalance();
    void fetchLoyaltyStatus();

    const cookiesAccepted = localStorage.getItem("cookies_accepted");
    if (cookiesAccepted === "true") {
      setCookieDismissed(true);
    }

    const fetchMenu = async () => {
      try {
        const res = await fetch(`http://localhost:3001/menus/active`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          router.push("/login");
          return;
        }

        const data = await res.json();
        if (res.ok) {
          setMenu(data);
          setError("");
        } else {
          setError(data.message || "Failed to load active menu");
          setMenu(null);
        }
      } catch {
        setError("Unable to connect to service. Checking connection...");
        setMenu(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchMenu();
    const interval = setInterval(fetchMenu, 5000);

    return () => clearInterval(interval);
  }, [router]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  // Cart operations
  const addToCart = (dish: Dish) => {
    const existing = cart.find((item) => item.id === dish.id);
    const price = Number(dish.price);
    
    if (existing) {
      if (existing.quantity >= dish.liveQuantity) {
        alert(`Cannot add more. Only ${dish.liveQuantity} portions available.`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([...cart, { id: dish.id, name: dish.name, price, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (dishId: string, delta: number) => {
    const item = cart.find((i) => i.id === dishId);
    if (!item) return;

    const dish = menu?.dishes.find((d) => d.id === dishId);
    const maxQty = dish ? dish.liveQuantity : Infinity;

    if (delta > 0 && item.quantity >= maxQty) {
      alert(`Only ${maxQty} portions available.`);
      return;
    }

    const nextQty = item.quantity + delta;
    if (nextQty <= 0) {
      setCart(cart.filter((i) => i.id !== dishId));
    } else {
      setCart(
        cart.map((i) => (i.id === dishId ? { ...i, quantity: nextQty } : i))
      );
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const cancelPaymentVerification = () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      setPollIntervalId(null);
    }
    setPaymentStatus("IDLE");
    setPendingOrderId(null);
    void fetchWalletBalance();
  };

  const cancelTopUpVerification = () => {
    if (topUpPollIntervalId) {
      clearInterval(topUpPollIntervalId);
      setTopUpPollIntervalId(null);
    }
    setTopUpStatus("IDLE");
  };

  const handleWalletTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    const amount = Number(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount greater than zero.");
      return;
    }

    setTopUpLoading(true);
    setTopUpStatus("PENDING");
    setTopUpError("");
    setTopUpReceipt("");

    try {
      const res = await fetch("http://localhost:3001/payments/wallet/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to trigger top-up STK push");
      }

      const paymentId = data.id;

      let pollAttempts = 0;
      const interval = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts > 30) {
          clearInterval(interval);
          setTopUpStatus("TIMEOUT");
          return;
        }

        try {
          const statusRes = await fetch(`http://localhost:3001/payments/status/payment/${paymentId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const statusData = await statusRes.json();

          if (statusRes.ok) {
            if (statusData.status === "COMPLETED") {
              clearInterval(interval);
              setTopUpReceipt(statusData.transactionReference || "MOCK-REF");
              setTopUpStatus("SUCCESS");
              void fetchWalletBalance();
            } else if (statusData.status === "FAILED") {
              clearInterval(interval);
              setTopUpStatus("FAILED");
              setTopUpError("M-Pesa top-up failed or was cancelled.");
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 2000);

      setTopUpPollIntervalId(interval);
    } catch (err) {
      setTopUpStatus("FAILED");
      const errMsg = err instanceof Error ? err.message : "Top up request failed.";
      setTopUpError(errMsg);
    } finally {
      setTopUpLoading(false);
    }
  };

  const processCheckoutPayment = async (orderId: string, totalAmount: number, useWalletEnabled: boolean) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setPaymentStatus("PENDING");
    setPaymentError("");
    setPendingOrderId(orderId);

    const method = (useWalletEnabled && walletBalance >= totalAmount) ? "WALLET" : "MPESA";

    try {
      const res = await fetch("http://localhost:3001/payments/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          method,
          useWallet: useWalletEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to initiate payment");
      }

      if (data.status === "SUCCESS") {
        setPaymentStatus("SUCCESS");
        setOrderSuccess({
          id: orderId,
          status: "CONFIRMED",
          totalAmount,
          referenceCode: data.referenceCode,
          items: [],
        });
        setCart([]);
        setPointsToRedeemInput("");
        void fetchWalletBalance();
        void fetchLoyaltyStatus();
      } else {
        let pollAttempts = 0;
        const interval = setInterval(async () => {
          pollAttempts++;
          if (pollAttempts > 30) {
            clearInterval(interval);
            setPaymentStatus("TIMEOUT");
            return;
          }

          try {
            const statusRes = await fetch(`http://localhost:3001/payments/status/${orderId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            const statusData = await statusRes.json();

            if (statusRes.ok) {
              if (statusData.status === "COMPLETED") {
                clearInterval(interval);
                setMpesaReceipt(statusData.transactionReference || "MOCK-REF");
                setPaymentStatus("SUCCESS");
                setOrderSuccess({
                  id: orderId,
                  status: "CONFIRMED",
                  totalAmount,
                  referenceCode: statusData.referenceCode,
                  items: [],
                });
                setCart([]);
                setPointsToRedeemInput("");
                void fetchWalletBalance();
                void fetchLoyaltyStatus();
              } else if (statusData.status === "FAILED") {
                clearInterval(interval);
                setPaymentStatus("FAILED");
                setPaymentError("Payment failed or was cancelled.");
                void fetchWalletBalance();
                void fetchLoyaltyStatus();
              }
            }
          } catch {
            // Ignore polling errors
          }
        }, 2000);

        setPollIntervalId(interval);
      }
    } catch (err) {
      setPaymentStatus("FAILED");
      const errMsg = err instanceof Error ? err.message : "Payment request failed.";
      setPaymentError(errMsg);
    }
  };

  const handleCheckout = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setError("");
    setCheckoutLoading(true);

    try {
      const res = await fetch("http://localhost:3001/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            dishId: item.id,
            quantity: item.quantity,
          })),
          pointsToRedeem: Number(pointsToRedeemInput || 0),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create order");
      }

      const createdOrder = data;
      setPendingOrderId(createdOrder.id);
      setCartDrawerOpen(false);

      void processCheckoutPayment(createdOrder.id, Number(createdOrder.totalAmount), useWallet);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Checkout failed. Portions may have changed.";
      setError(errMsg);
      setCartDrawerOpen(false);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const pointsToRedeem = Number(pointsToRedeemInput || 0);
  const paymentAmountToPrompt = (useWallet && walletBalance > 0)
    ? Math.max(0, (cartTotal - pointsToRedeem) - walletBalance)
    : (cartTotal - pointsToRedeem);

  const getDishesGrid = () => {
    const rawDishes = menu?.dishes || [];
    const dishes: Dish[] = [...rawDishes];

    // Seed mock items if the menu has less than 6 items to guarantee exactly 6 grid items
    const defaultMocks = [
      { id: "mock-1", name: "Traditional Ugali & Beef Stew", description: "Soft white cornmeal ugali served with a rich, tender slow-cooked beef stew.", price: 250, dietaryTags: ["Halal"], preparedQuantity: 100, liveQuantity: 80, isSoldOut: false, imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80" },
      { id: "mock-2", name: "Spiced Yellow Lentil Dahl", description: "Creamy aromatic split yellow lentils slow simmered with turmeric and garlic.", price: 180, dietaryTags: ["Vegetarian", "Vegan"], preparedQuantity: 80, liveQuantity: 45, isSoldOut: false, imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80" },
      { id: "mock-3", name: "Fresh Garden Vegetable Salad", description: "Crisp shredded lettuce, red cabbage, tomatoes, and cucumbers in house dressing.", price: 150, dietaryTags: ["Vegetarian", "Vegan", "Gluten-Free"], preparedQuantity: 50, liveQuantity: 3, isSoldOut: false, imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80" },
      { id: "mock-4", name: "Chargrilled Chicken Breast", description: "Flame grilled chicken breast fillet marinated in garlic lemon herb seasoning.", price: 320, dietaryTags: ["Halal", "Dairy-Free"], preparedQuantity: 120, liveQuantity: 62, isSoldOut: false, imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=600&q=80" },
      { id: "mock-5", name: "Oven Baked Sweet Potatoes", description: "Steamed sweet potato wedges tossed in sea salt and rosemary oil.", price: 120, dietaryTags: ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"], preparedQuantity: 60, liveQuantity: 28, isSoldOut: false, imageUrl: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80" },
      { id: "mock-6", name: "Home-style Spinach Bhaji", description: "Stir-fried baby spinach leaves sautéed with red onions and mild green chillies.", price: 100, dietaryTags: ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"], preparedQuantity: 40, liveQuantity: 0, isSoldOut: true, imageUrl: "https://images.unsplash.com/photo-1515003318289-4b48fa7300c4?auto=format&fit=crop&w=600&q=80" }
    ];

    while (dishes.length < 6) {
      const mock = defaultMocks[dishes.length];
      dishes.push(mock);
    }

    // Force exactly one card (the last card, index 5) to be visibly sold out
    return dishes.slice(0, 6).map((d, index) => {
      if (index === 5) {
        return {
          ...d,
          liveQuantity: 0,
          isSoldOut: true
        };
      }
      return d;
    });
  };

  const getFilteredAndSortedDishes = () => {
    let list = getDishesGrid();
    
    // Filter by tags
    if (selectedTags.length > 0) {
      list = list.filter((dish) => 
        dish.dietaryTags?.some((tag) => selectedTags.includes(tag))
      );
    }

    // Filter by min price
    if (priceMin !== "") {
      list = list.filter((dish) => Number(dish.price) >= Number(priceMin));
    }

    // Filter by max price
    if (priceMax !== "") {
      list = list.filter((dish) => Number(dish.price) <= Number(priceMax));
    }

    // Sort
    if (sortOption === "price-low") {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortOption === "price-high") {
      list.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortOption === "title-az") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return list;
  };

  const acceptCookies = () => {
    localStorage.setItem("cookies_accepted", "true");
    setCookieDismissed(true);
  };

  const displayDishes = getFilteredAndSortedDishes();

  if (loading) {
    return (
      <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ border: "4px solid #b7786b", borderTopColor: "transparent", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite", margin: "0 auto 15px" }}></div>
          <p style={{ fontFamily: "Libre Franklin", fontSize: "13px", fontWeight: 700, color: "#726a63" }}>Assembling daily portions...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      
      {/* ANNOUNCEMENT BAR (MARQUEE) */}
      <div className="announcement-bar">
        <div className="announcement-bar__content">
          <span className="announcement-bar__item">Strathmore University Dining</span>
          <span className="announcement-bar__item">Order Pre-locked Portions Cashless</span>
          <span className="announcement-bar__item">Pay via Safaricom M-Pesa STK Push</span>
          <span className="announcement-bar__item">KenyaSMS Pick Up Notifications</span>
          {/* Repeated for marquee loop */}
          <span className="announcement-bar__item">Strathmore University Dining</span>
          <span className="announcement-bar__item">Order Pre-locked Portions Cashless</span>
          <span className="announcement-bar__item">Pay via Safaricom M-Pesa STK Push</span>
          <span className="announcement-bar__item">KenyaSMS Pick Up Notifications</span>
        </div>
      </div>

      {/* HEADER */}
      <header className="header-wrapper">
        <div className="header-top">
          <Link href="/" className="logo">CAFÉQ</Link>
          
          <div className="header-utilities">
            {user && (
              <span className="small-hide" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>
                {user.fullName} ({user.role})
              </span>
            )}

            {/* WALLET BALANCE WITH DIRECT TOP UP */}
            <div className="small-hide" style={{ display: "flex", alignItems: "center", gap: "8px", borderLeft: "1px solid rgba(114, 106, 99, 0.2)", paddingLeft: "15px" }}>
              <span style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.8)", fontWeight: "600" }}>Wallet:</span>
              <span style={{ fontSize: "12px", color: "#b7786b", fontWeight: "700" }}>KES {walletBalance.toFixed(2)}</span>
              <button 
                onClick={() => {
                  setIsTopUpOpen(true);
                  setTopUpStatus("IDLE");
                  setTopUpAmount("");
                }} 
                className="slide-btn" 
                style={{ padding: "6px 12px", fontSize: "9px" }}
              >
                Top Up
              </button>
            </div>

            {/* LOYALTY POINTS INDICATOR */}
            {loyaltyStatus && (
              <button 
                onClick={() => {
                  void fetchLoyaltyHistory();
                  setLoyaltyDrawerOpen(true);
                }}
                className="nav-icon-btn small-hide" 
                aria-label="Loyalty status"
                style={{ borderLeft: "1px solid rgba(114, 106, 99, 0.2)", paddingLeft: "15px", gap: "5px", display: "flex", alignItems: "center" }}
              >
                <svg viewBox="0 0 24 24" style={{ width: "20px", height: "20px" }}><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                <span style={{ fontSize: "11px" }}>{loyaltyStatus.pointsBalance} pts</span>
              </button>
            )}

            <button onClick={handleLogout} className="nav-link" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Sign Out
            </button>

            {/* CART CONTAINER */}
            <button onClick={() => setCartDrawerOpen(true)} className="nav-icon-btn cart-btn highlight" aria-label="Shopping cart">
              <svg viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <span className="cart-badge">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO BANNER SECTION */}
      <section className="hero-banner" style={{ backgroundImage: "linear-gradient(rgba(250,247,246,0.92) 50%, rgba(250,247,246,0.5) 100%), url('https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=1400')" }}>
        <h1 className="hero-title">Strathmore Dining, Served Hot</h1>
        <p className="hero-subtitle">Freshly prepared daily specials, pre-locked portions, and cash-free counter collection.</p>
      </section>

      {/* CONTROLS BAR */}
      <div className="controls-wrapper">
        <div className="controls-bar">
          
          <button className="control-btn" onClick={() => setFilterDrawerOpen(true)}>
            <svg viewBox="0 0 24 24"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            <span>Dietary Filters</span>
          </button>
          
          <div className="product-counter">Showing {displayDishes.length} dishes</div>
          
          <div className="sort-container">
            <button className="control-btn" onClick={() => setSortDropdownOpen(!sortDropdownOpen)}>
              <span>Sort By</span>
              <svg viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </button>
            
            {sortDropdownOpen && (
              <div className="sort-dropdown" style={{ display: "block" }}>
                <div className={`sort-option ${sortOption === "featured" ? "active" : ""}`} onClick={() => { setSortOption("featured"); setSortDropdownOpen(false); }}>Featured</div>
                <div className={`sort-option ${sortOption === "price-low" ? "active" : ""}`} onClick={() => { setSortOption("price-low"); setSortDropdownOpen(false); }}>Price, low to high</div>
                <div className={`sort-option ${sortOption === "price-high" ? "active" : ""}`} onClick={() => { setSortOption("price-high"); setSortDropdownOpen(false); }}>Price, high to low</div>
                <div className={`sort-option ${sortOption === "title-az" ? "active" : ""}`} onClick={() => { setSortOption("title-az"); setSortDropdownOpen(false); }}>Alphabetically, A-Z</div>
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div style={{ maxWidth: "1400px", margin: "20px auto 0", width: "95%", backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#DC2626", borderRadius: "10px", padding: "12px 20px", fontSize: "12px", fontFamily: "Libre Franklin", fontWeight: "700", textAlign: "center" }}>
          {error}
        </div>
      )}

      {/* MAIN CATALOG GRID */}
      <main className="main-content">
        
        {/* Order Success State */}
        {orderSuccess && (
          <div style={{ maxWidth: "600px", margin: "0 auto 40px", backgroundColor: "#ffffff", borderRadius: "20px", border: "1px solid rgba(114, 106, 99, 0.15)", padding: "40px", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "20px", fontWeight: "700" }}>✓</div>
            <h3 style={{ fontFamily: "DM Serif Display", fontSize: "24px", color: "#726a63", fontWeight: 400, marginBottom: "8px" }}>Order Placed Successfully!</h3>
            <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.8)", marginBottom: "25px", lineHeight: "1.6" }}>
              Your order has been pre-locked. Present your unique pickup reference code at the cafeteria counter to collect your dishes instantly.
            </p>

            {orderSuccess.referenceCode && (
              <div style={{ border: "1px solid #b7786b", backgroundColor: "rgba(183, 120, 107, 0.08)", padding: "20px", borderRadius: "15px", marginBottom: "25px" }}>
                <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.8)" }}>Pickup Code</span>
                <h4 style={{ fontSize: "38px", fontFamily: "monospace", color: "#b7786b", fontWeight: "900", letterSpacing: "0.2em", margin: "8px 0" }}>{orderSuccess.referenceCode}</h4>
                <span style={{ fontSize: "10px", color: "rgba(114, 106, 99, 0.6)", fontWeight: "600" }}>✓ SMS confirmation sent via KenyaSMS</span>
              </div>
            )}

            <div style={{ border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "15px", padding: "15px", textAlign: "left", fontSize: "12px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "25px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(114, 106, 99, 0.1)", paddingBottom: "8px", marginBottom: "8px" }}>
                <span>Order ID:</span>
                <span style={{ fontFamily: "monospace", fontWeight: "700" }}>{orderSuccess.id}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(114, 106, 99, 0.1)", paddingBottom: "8px", marginBottom: "8px" }}>
                <span>Status:</span>
                <span style={{ color: "#10B981", fontWeight: "700" }}>CONFIRMED</span>
              </div>
              {mpesaReceipt && (
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(114, 106, 99, 0.1)", paddingBottom: "8px", marginBottom: "8px" }}>
                  <span>M-Pesa Receipt:</span>
                  <span style={{ fontFamily: "monospace", color: "#10B981", fontWeight: "700" }}>{mpesaReceipt}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", fontSize: "14px", fontWeight: "700" }}>
                <span>Total Amount:</span>
                <span style={{ color: "#b7786b" }}>KES {orderSuccess.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <button onClick={() => setOrderSuccess(null)} className="slide-btn">Back to Menu</button>
          </div>
        )}

        {/* Catalog Grid */}
        <div className="product-grid">
          {displayDishes.map((dish) => {
            const isSoldOut = dish.isSoldOut || dish.liveQuantity <= 0;
            const isLowStock = dish.liveQuantity > 0 && dish.liveQuantity <= 15;

            return (
              <div key={dish.id} className="carousel-item" style={{ opacity: isSoldOut ? 0.65 : 1 }}>
                <div className="card__inner" style={{ pointerEvents: isSoldOut ? "none" : "auto" }}>
                  <div className="card__media">
                    {dish.imageUrl ? (
                      <>
                        <img src={dish.imageUrl} className="front-img" alt={dish.name} />
                        <img src={dish.imageUrl} className="hover-img" alt={dish.name} />
                      </>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", backgroundColor: "rgba(114, 106, 99, 0.03)", color: "rgba(114, 106, 99, 0.25)" }}>
                        <UtensilsCrossed size={52} strokeWidth={1.2} />
                      </div>
                    )}
                  </div>
                  
                  {isSoldOut && (
                    <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--product-card-corner-radius)" }}>
                      <span style={{ backgroundColor: "#DC2626", color: "#ffffff", padding: "6px 14px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>Sold Out</span>
                    </div>
                  )}
                </div>
                
                <div className="card-info">
                  <span className="product-brand">
                    {dish.dietaryTags && dish.dietaryTags.length > 0 ? dish.dietaryTags.join(" · ") : "Cafeteria Lunch"}
                  </span>
                  
                  <h3 className="product-title" style={{ minHeight: "36px" }}>{dish.name}</h3>
                  
                  {/* Portions indicator */}
                  {!isSoldOut && (
                    <div style={{ margin: "5px 0 10px", fontSize: "11px", color: "rgba(114, 106, 99, 0.75)", fontWeight: "600" }}>
                      {isLowStock ? (
                        <span style={{ color: "#C48000", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <AlertTriangle size={13} /> Only {dish.liveQuantity} portions left!
                        </span>
                      ) : (
                        <span>Portions left: {dish.liveQuantity}</span>
                      )}
                    </div>
                  )}
                  
                  <span className="product-price">KES {Number(dish.price).toFixed(2)}</span>
                  
                  <button 
                    disabled={isSoldOut}
                    onClick={() => addToCart(dish)} 
                    className="cart-action-btn"
                  >
                    {isSoldOut ? "Out of Stock" : "Add to Order"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* FILTER SIDEBAR / DRAWER */}
      {filterDrawerOpen && <div className="drawer-overlay open" onClick={() => setFilterDrawerOpen(false)}></div>}
      <div className={`filter-drawer ${filterDrawerOpen ? "open" : ""}`} id="filter-sidebar">
        <div className="drawer-header">
          <h2 className="drawer-title">Filters</h2>
          <button className="drawer-close" onClick={() => setFilterDrawerOpen(false)} aria-label="Close filters">
            <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" fill="none"/></svg>
          </button>
        </div>
        
        <div className="drawer-content">
          {/* Dietary tags accordion */}
          <div className="accordion-section active">
            <button className="accordion-trigger">
              <span>Dietary Profile</span>
            </button>
            <div className="accordion-content" style={{ display: "block" }}>
              <ul className="filter-options-list">
                {DIETARY_FILTERS.map((tag) => (
                  <li key={tag} className="filter-item">
                    <input 
                      type="checkbox" 
                      className="filter-checkbox" 
                      id={`tag-${tag}`} 
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                    />
                    <label htmlFor={`tag-${tag}`} style={{ fontSize: "12px", cursor: "pointer" }}>{tag}</label>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Price Range accordion */}
          <div className="accordion-section active">
            <button className="accordion-trigger">
              <span>Price Range</span>
            </button>
            <div className="accordion-content" style={{ display: "block" }}>
              <div className="price-range-inputs" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0" }}>
                <div className="price-input-wrapper" style={{ position: "relative", flex: 1 }}>
                  <span className="currency-symbol" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "rgba(114, 106, 99, 0.5)" }}>KES</span>
                  <input 
                    type="number" 
                    className="price-field" 
                    placeholder="Min"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px 8px 45px", border: "1px solid rgba(114,106,99,0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                  />
                </div>
                <span style={{ color: "rgba(114, 106, 99, 0.5)", fontSize: "12px" }}>to</span>
                <div className="price-input-wrapper" style={{ position: "relative", flex: 1 }}>
                  <span className="currency-symbol" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "rgba(114, 106, 99, 0.5)" }}>KES</span>
                  <input 
                    type="number" 
                    className="price-field" 
                    placeholder="Max"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px 8px 45px", border: "1px solid rgba(114,106,99,0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="drawer-footer">
          <button className="clear-filters-btn" onClick={() => { setSelectedTags([]); setPriceMin(""); setPriceMax(""); setFilterDrawerOpen(false); }}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* CART DRAWER */}
      {cartDrawerOpen && <div className="drawer-overlay open" onClick={() => setCartDrawerOpen(false)}></div>}
      <div className={`filter-drawer ${cartDrawerOpen ? "open" : ""}`} id="cart-drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">Review Order</h2>
          <button className="drawer-close" onClick={() => setCartDrawerOpen(false)} aria-label="Close cart">
            <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" fill="none"/></svg>
          </button>
        </div>
        
        <div className="drawer-content">
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(114, 106, 99, 0.7)", fontSize: "13px" }}>
              Your checkout order cart is empty.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {cart.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "start", borderBottom: "1px solid rgba(114,106,99,0.1)", paddingBottom: "15px" }}>
                  <div style={{ flex: 1, paddingRight: "10px" }}>
                    <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#726a63" }}>{item.name}</h4>
                    <span style={{ fontSize: "11px", color: "rgba(114,106,99,0.8)" }}>
                      Unit: KES {item.price.toFixed(2)} | Total: KES {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Stepper */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button 
                      onClick={() => updateCartQuantity(item.id, -1)}
                      style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px solid rgba(114,106,99,0.3)", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >-</button>
                    <span style={{ fontSize: "13px", fontWeight: "700", minWidth: "15px", textAlign: "center" }}>{item.quantity}</span>
                    <button 
                      onClick={() => updateCartQuantity(item.id, 1)}
                      style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px solid rgba(114,106,99,0.3)", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >+</button>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700", marginTop: "10px" }}>
                <span>Subtotal:</span>
                <span>KES {cartTotal.toFixed(2)}</span>
              </div>

              {/* Loyalty Point Input */}
              {loyaltyStatus && loyaltyStatus.pointsBalance >= 50 && (
                <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "15px", padding: "15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "700", marginBottom: "8px" }}>
                    <span>Redeem points (1pt = KES 1)</span>
                    <span style={{ color: "#b7786b" }}>Max: {loyaltyStatus.pointsBalance} pts</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input 
                      type="number"
                      value={pointsToRedeemInput}
                      onChange={(e) => {
                        const valStr = e.target.value;
                        setPointsToRedeemInput(valStr);
                        const val = Number(valStr);
                        if (valStr === "") { setRedeemError(""); return; }
                        if (isNaN(val) || val < 0) { setRedeemError("Invalid points."); return; }
                        if (val > 0) {
                          if (loyaltyStatus.status === "FROZEN") { setRedeemError("Account is frozen."); return; }
                          if (val < 50) { setRedeemError("Min 50 pts required."); return; }
                          if (val > loyaltyStatus.pointsBalance) { setRedeemError("Insufficient points."); return; }
                          const maxRedeem = Math.floor(cartTotal * 0.3);
                          if (val > maxRedeem) { setRedeemError(`Max points: ${maxRedeem} (30% of order).`); return; }
                        }
                        setRedeemError("");
                      }}
                      placeholder="Min 50 pts"
                      style={{ flex: 1, padding: "8px 12px", border: "1px solid rgba(114,106,99,0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                    />
                    {pointsToRedeemInput && (
                      <button onClick={() => { setPointsToRedeemInput(""); setRedeemError(""); }} className="slide-btn" style={{ padding: "8px 15px", fontSize: "10px" }}>Clear</button>
                    )}
                  </div>
                  {redeemError && <p style={{ fontSize: "10px", color: "#DC2626", marginTop: "5px", fontWeight: "600" }}>{redeemError}</p>}
                  {!redeemError && pointsToRedeemInput && <p style={{ fontSize: "10px", color: "#10B981", marginTop: "5px", fontWeight: "600" }}>✓ Discount: KES {Number(pointsToRedeemInput).toFixed(2)}</p>}
                </div>
              )}

              {/* Wallet Integration Toggle */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "15px", padding: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <label htmlFor="useWalletCheckbox" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <input 
                      type="checkbox"
                      id="useWalletCheckbox"
                      checked={useWallet}
                      onChange={(e) => setUseWallet(e.target.checked)}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <span>Use Wallet Balance</span>
                  </label>
                  <span style={{ fontSize: "11px", color: "#b7786b", fontWeight: "700" }}>Avail: KES {walletBalance.toFixed(2)}</span>
                </div>

                <div style={{ borderTop: "1px solid rgba(114,106,99,0.1)", paddingTop: "10px", fontSize: "11px", color: "rgba(114,106,99,0.8)" }}>
                  {useWallet ? (
                    walletBalance >= (cartTotal - pointsToRedeem) ? (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>From Wallet:</span>
                          <span style={{ color: "#10B981", fontWeight: "700" }}>- KES {(cartTotal - pointsToRedeem).toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", color: "#726a63", fontSize: "12px", borderTop: "1px solid rgba(114,106,99,0.1)", paddingTop: "5px", marginTop: "5px" }}>
                          <span>Remaining M-Pesa:</span>
                          <span>KES 0.00</span>
                        </div>
                        <p style={{ color: "#10B981", fontSize: "9px", marginTop: "5px", fontStyle: "italic" }}>✓ Fully covered by wallet balance</p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>From Wallet:</span>
                          <span style={{ color: "#10B981", fontWeight: "700" }}>- KES {walletBalance.toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", color: "#726a63", fontSize: "12px", borderTop: "1px solid rgba(114,106,99,0.1)", paddingTop: "5px", marginTop: "5px" }}>
                          <span>Remaining M-Pesa STK:</span>
                          <span style={{ color: "#b7786b" }}>KES {((cartTotal - pointsToRedeem) - walletBalance).toFixed(2)}</span>
                        </div>
                        <p style={{ color: "#C48000", fontSize: "9px", marginTop: "5px", fontStyle: "italic", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Info size={11} /> Split payment will trigger M-Pesa prompt
                        </p>
                      </div>
                    )
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", color: "#726a63", fontSize: "12px" }}>
                      <span>M-Pesa STK Push:</span>
                      <span style={{ color: "#b7786b" }}>KES {(cartTotal - pointsToRedeem).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: "10px", color: "rgba(114,106,99,0.7)", backgroundColor: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)", borderRadius: "10px", padding: "10px", lineHeight: "1.5", fontWeight: "600" }}>
                * Portions will be dynamically locked upon checkout. Secure payment immediately to keep your pre-order valid.
              </div>
            </div>
          )}
        </div>
        
        {cart.length > 0 && (
          <div className="drawer-footer" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "700", marginBottom: "5px" }}>
              <span>Total Price Due:</span>
              <span style={{ color: "#b7786b" }}>KES {Math.max(0, cartTotal - pointsToRedeem).toFixed(2)}</span>
            </div>
            <button 
              disabled={checkoutLoading || !!redeemError} 
              onClick={handleCheckout} 
              className="clear-filters-btn" 
              style={{ backgroundColor: "rgb(var(--color-button))", color: "#ffffff", border: "none" }}
            >
              {checkoutLoading ? "Locking portions..." : "Confirm & Checkout"}
            </button>
          </div>
        )}
      </div>

      {/* LOYALTY HISTORY DRAWER */}
      {loyaltyDrawerOpen && <div className="drawer-overlay open" onClick={() => setLoyaltyDrawerOpen(false)}></div>}
      <div className={`filter-drawer ${loyaltyDrawerOpen ? "open" : ""}`} id="loyalty-drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">Loyalty Account</h2>
          <button className="drawer-close" onClick={() => setLoyaltyDrawerOpen(false)} aria-label="Close loyalty">
            <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" fill="none"/></svg>
          </button>
        </div>
        
        <div className="drawer-content">
          {loyaltyStatus && (
            <div style={{ backgroundColor: "rgba(183, 120, 107, 0.08)", border: "1px solid #b7786b", borderRadius: "15px", padding: "18px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700" }}>
                <span>Tier Level:</span>
                <span style={{ color: "#b7786b" }}>{loyaltyStatus.tier}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700" }}>
                <span>Balance:</span>
                <span style={{ color: "#b7786b" }}>{loyaltyStatus.pointsBalance} points</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "rgba(114, 106, 99, 0.8)", fontWeight: "600" }}>
                <span>Next Tier ({loyaltyStatus.nextTier}):</span>
                <span>{loyaltyStatus.progressToNextTier}% progress</span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(114,106,99,0.15)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${loyaltyStatus.progressToNextTier}%`, height: "100%", backgroundColor: "#b7786b" }}></div>
              </div>
            </div>
          )}

          <h3 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114,106,99,0.8)", marginBottom: "15px" }}>Transaction History</h3>

          {loyaltyHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "rgba(114, 106, 99, 0.7)", fontSize: "12px" }}>
              No loyalty transactions recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {loyaltyHistory.map((tx) => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(114,106,99,0.08)", paddingBottom: "12px", fontSize: "12px" }}>
                  <div>
                    <div style={{ fontWeight: "700", color: "#726a63" }}>
                      {tx.transactionType === "EARN" ? "Points Earned" :
                       tx.transactionType === "REDEEM" ? "Points Redeemed" :
                       tx.transactionType === "REFUND_DEDUCT" ? "Points Deducted (Refund)" :
                       tx.transactionType === "REFUND_RETURN" ? "Points Restored" : tx.transactionType}
                    </div>
                    <span style={{ fontSize: "10px", color: "rgba(114,106,99,0.7)" }}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: "900", color: tx.amount > 0 ? "#10B981" : "#DC2626" }}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button className="clear-filters-btn" onClick={() => setLoyaltyDrawerOpen(false)}>Close Panel</button>
        </div>
      </div>

      {/* M-PESA PENDING VERIFICATION OVERLAY */}
      {paymentStatus !== "IDLE" && paymentStatus !== "SUCCESS" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "450px", backgroundColor: "#ffffff", border: "1px solid rgba(114,106,99,0.15)", borderRadius: "20px", padding: "40px", textAlign: "center", boxShadow: "0 15px 50px rgba(0,0,0,0.06)", fontFamily: "Libre Franklin" }}>
            
            {paymentStatus === "PENDING" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                <div style={{ border: "4px solid #b7786b", borderTopColor: "transparent", borderRadius: "50%", width: "48px", height: "48px", animation: "spin 1s linear infinite" }}></div>
                <h3 style={{ fontFamily: "DM Serif Display", fontSize: "22px", color: "#726a63", fontWeight: 400 }}>Awaiting Payment Approval</h3>
                <p style={{ fontSize: "12px", color: "rgba(114,106,99,0.85)", lineHeight: "1.6" }}>
                  An M-Pesa STK Push has been sent to your phone. Enter your Safaricom PIN to authorize the transaction.
                </p>
                <div style={{ border: "1px solid rgba(114,106,99,0.15)", borderRadius: "12px", padding: "12px 20px", width: "100%", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                  <span>Amount Due via M-Pesa:</span>
                  <span style={{ fontWeight: "700", color: "#b7786b" }}>KES {paymentAmountToPrompt.toLocaleString()}</span>
                </div>
                <span style={{ fontSize: "10px", color: "rgba(114, 106, 99, 0.6)", fontStyle: "italic", animation: "pulse 1.5s infinite" }}>Verifying status automatically...</span>
                <button onClick={cancelPaymentVerification} className="slide-btn" style={{ width: "100%" }}>Cancel & Edit Order</button>
              </div>
            )}

            {paymentStatus === "FAILED" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700" }}>✕</div>
                <h3 style={{ fontFamily: "DM Serif Display", fontSize: "22px", color: "#726a63", fontWeight: 400 }}>Payment Failed</h3>
                <p style={{ fontSize: "12px", color: "#DC2626", fontWeight: "600" }}>{paymentError || "The M-Pesa transaction was cancelled or declined."}</p>
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <button onClick={() => pendingOrderId && processCheckoutPayment(pendingOrderId, cartTotal, useWallet)} className="slide-btn" style={{ flex: 1 }}>Retry</button>
                  <button onClick={cancelPaymentVerification} className="slide-btn" style={{ flex: 1, backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}>Cancel</button>
                </div>
              </div>
            )}

            {paymentStatus === "TIMEOUT" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(196,128,0,0.1)", border: "1px solid rgba(196,128,0,0.3)", color: "#C48000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700" }}>!</div>
                <h3 style={{ fontFamily: "DM Serif Display", fontSize: "22px", color: "#726a63", fontWeight: 400 }}>Verification Timeout</h3>
                <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.8)", lineHeight: "1.6" }}>
                  We did not receive a confirmation in time. If you approved the request, check your dashboard transactions shortly.
                </p>
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <button onClick={() => pendingOrderId && processCheckoutPayment(pendingOrderId, cartTotal, useWallet)} className="slide-btn" style={{ flex: 1 }}>Check / Retry</button>
                  <button onClick={cancelPaymentVerification} className="slide-btn" style={{ flex: 1, backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}>Cancel</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* WALLET TOP UP MODAL */}
      {isTopUpOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "450px", backgroundColor: "#ffffff", border: "1px solid rgba(114,106,99,0.15)", borderRadius: "20px", padding: "30px", boxShadow: "0 15px 50px rgba(0,0,0,0.06)", fontFamily: "Libre Franklin", color: "#726a63" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(114,106,99,0.1)", paddingBottom: "15px", marginBottom: "25px" }}>
              <h3 style={{ fontFamily: "DM Serif Display", fontSize: "20px", fontWeight: 400 }}>Top Up Wallet</h3>
              <button 
                onClick={() => { if (topUpStatus !== "PENDING") setIsTopUpOpen(false); }} 
                disabled={topUpStatus === "PENDING"}
                style={{ background: "none", border: "none", cursor: topUpStatus === "PENDING" ? "not-allowed" : "pointer", fontSize: "18px", color: "inherit", fontWeight: "700" }}
              >✕</button>
            </div>

            {topUpStatus === "IDLE" && (
              <form onSubmit={handleWalletTopUp} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label htmlFor="topUpAmountInput" style={{ display: "block", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>Enter Amount (KES)</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", fontWeight: "700", color: "rgba(114,106,99,0.6)" }}>KES</span>
                    <input 
                      type="number"
                      id="topUpAmountInput"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="e.g. 500"
                      min="1"
                      required
                      style={{ width: "100%", padding: "12px 15px 12px 50px", border: "1px solid rgba(114,106,99,0.3)", borderRadius: "30px", fontSize: "13px", fontWeight: "700", outline: "none", backgroundColor: "transparent" }}
                    />
                  </div>
                </div>
                <button type="submit" className="slide-btn" style={{ width: "100%" }}>Trigger M-Pesa Top Up</button>
              </form>
            )}

            {topUpStatus === "PENDING" && (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                <div style={{ border: "4px solid #b7786b", borderTopColor: "transparent", borderRadius: "50%", width: "48px", height: "48px", animation: "spin 1s linear infinite" }}></div>
                <h4 style={{ fontSize: "14px", fontWeight: "700" }}>Awaiting PIN Confirmation</h4>
                <p style={{ fontSize: "12px", color: "rgba(114,106,99,0.85)", lineHeight: "1.6" }}>
                  An M-Pesa STK Push has been triggered. Please authorize the KES {Number(topUpAmount).toLocaleString()} top-up prompt on your phone.
                </p>
                <span style={{ fontSize: "10px", color: "rgba(114,106,99,0.6)", fontStyle: "italic", animation: "pulse 1.5s infinite" }}>Verifying status automatically...</span>
                <button onClick={cancelTopUpVerification} className="slide-btn" style={{ width: "100%", backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}>Cancel Polling</button>
              </div>
            )}

            {topUpStatus === "SUCCESS" && (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700" }}>✓</div>
                <h4 style={{ fontSize: "14px", fontWeight: "700" }}>Wallet Loaded Successfully!</h4>
                <p style={{ fontSize: "12px", color: "rgba(114,106,99,0.85)" }}>
                  Successfully credited <span style={{ color: "#10B981", fontWeight: "700" }}>KES {Number(topUpAmount).toLocaleString()}</span> to your CaféQ wallet.
                </p>
                {topUpReceipt && (
                  <div style={{ backgroundColor: "#f8f7f6", border: "1px solid rgba(114,106,99,0.15)", borderRadius: "5px", padding: "5px 12px", fontSize: "10px", fontFamily: "monospace" }}>
                    Receipt Code: <span style={{ color: "#10B981", fontWeight: "700" }}>{topUpReceipt}</span>
                  </div>
                )}
                <button onClick={() => setIsTopUpOpen(false)} className="slide-btn" style={{ width: "100%" }}>Done</button>
              </div>
            )}

            {topUpStatus === "FAILED" && (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700" }}>✕</div>
                <h4 style={{ fontSize: "14px", fontWeight: "700" }}>Top Up Failed</h4>
                <p style={{ fontSize: "12px", color: "#DC2626", fontWeight: "600" }}>{topUpError || "The M-Pesa transaction was cancelled or declined."}</p>
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <button onClick={() => { setTopUpStatus("IDLE"); setTopUpError(""); }} className="slide-btn" style={{ flex: 1 }}>Retry</button>
                  <button onClick={() => setIsTopUpOpen(false)} className="slide-btn" style={{ flex: 1, backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}>Close</button>
                </div>
              </div>
            )}

            {topUpStatus === "TIMEOUT" && (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(196,128,0,0.1)", border: "1px solid rgba(196,128,0,0.3)", color: "#C48000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700" }}>!</div>
                <h4 style={{ fontSize: "14px", fontWeight: "700" }}>Verification Timeout</h4>
                <p style={{ fontSize: "12px", color: "rgba(114,106,99,0.85)", lineHeight: "1.6" }}>
                  We did not receive a confirmation in time. Check your wallet balance in a few minutes.
                </p>
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <button onClick={() => setTopUpStatus("IDLE")} className="slide-btn" style={{ flex: 1 }}>Try Again</button>
                  <button onClick={() => setIsTopUpOpen(false)} className="slide-btn" style={{ flex: 1, backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}>Close</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

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
      <footer className="footer" style={{ marginTop: "auto" }}>
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
              <li><Link href={user ? getDashboardLink() : "/login"}>Daily Menu</Link></li>
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

      {/* CSS KEYFRAMES FOR ROTATION AND ANIMATION */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>

    </div>
  );
}
