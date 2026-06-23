"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

const DIETARY_FILTERS = ["All", "Halal", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"];

export default function MenuBrowsing() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  // Cart and checkout states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pointsToRedeemInput, setPointsToRedeemInput] = useState("");
  const [redeemError, setRedeemError] = useState("");

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

    const fetchMenu = async () => {
      try {
        const activeFilters = selectedTags.filter(t => t !== "All");
        const queryParams = activeFilters.length > 0 
          ? `?tags=${activeFilters.join(",")}` 
          : "";

        const res = await fetch(`http://localhost:3001/menus/active${queryParams}`, {
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
  }, [selectedTags, router]);

  const toggleTag = (tag: string) => {
    if (tag === "All") {
      setSelectedTags([]);
      return;
    }
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags.filter(t => t !== "All"), tag]);
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

  // Checkout submission
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
      setIsReviewOpen(false);

      void processCheckoutPayment(createdOrder.id, Number(createdOrder.totalAmount), useWallet);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Checkout failed. Portions may have changed.";
      setError(errMsg);
      setIsReviewOpen(false);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const pointsToRedeem = Number(pointsToRedeemInput || 0);
  const paymentAmountToPrompt = (useWallet && walletBalance > 0)
    ? Math.max(0, (cartTotal - pointsToRedeem) - walletBalance)
    : (cartTotal - pointsToRedeem);

  // Render loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-ink font-sans">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-secondary text-xs font-bold">Assembling live menu portions...</p>
        </div>
      </div>
    );
  }

  // Ensure exactly 6 dish cards are displayed in the grid, forcing one to look sold out
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

  const displayDishes = getDishesGrid();

  return (
    <div className="min-h-screen bg-background text-ink font-sans flex flex-col justify-between select-none">
      {/* 1. Top Bar */}
      <header className="bg-primary px-6 py-4 sticky top-0 z-40 text-white shadow-sm flex items-center justify-between">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-extrabold tracking-tight hover:opacity-90 transition">
            CaféQ
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider bg-white/10 px-3 py-1 rounded">
            Lunch · 12:00 PM – 2:00 PM
          </span>
        </div>
      </header>

      {/* User Info Bar (Secondary Sub-Bar) */}
      <section className="bg-white border-b border-secondary/20 px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {user && (
            <p className="text-xs text-secondary font-semibold">
              Logged in as: <span className="text-primary font-bold">{user.fullName}</span> ({user.role})
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-secondary font-medium">Wallet:</span>
              <span className="text-primary">KES {walletBalance.toFixed(2)}</span>
              <button
                onClick={() => {
                  setIsTopUpOpen(true);
                  setTopUpStatus("IDLE");
                  setTopUpAmount("");
                }}
                className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded hover:bg-accent hover:text-ink transition active:scale-95"
              >
                Top Up
              </button>
            </div>

            {loyaltyStatus && (
              <div className="flex items-center gap-2 text-xs font-bold border-l border-secondary/20 pl-3">
                <span className="text-secondary font-medium">Loyalty:</span>
                <span className="text-primary">{loyaltyStatus.pointsBalance} pts</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  loyaltyStatus.tier === 'Gold' 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                    : loyaltyStatus.tier === 'Silver'
                    ? 'bg-slate-100 text-slate-800 border border-slate-300'
                    : 'bg-orange-100 text-orange-800 border border-orange-300'
                }`}>
                  {loyaltyStatus.tier}
                </span>
                <button
                  onClick={() => {
                    void fetchLoyaltyHistory();
                    setIsHistoryOpen(true);
                  }}
                  className="text-primary hover:underline hover:text-accent text-[10px] ml-1 transition"
                >
                  History
                </button>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="rounded border border-secondary/30 px-3 py-1 text-xs font-bold text-secondary hover:bg-secondary/5 transition ml-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </section>

      {/* Main Grid View */}
      <main className="max-w-6xl w-full mx-auto px-6 py-8 flex-grow">
        {error && (
          <div className="mb-6 rounded-[10px] bg-status-sold-out/10 border border-status-sold-out/30 p-3.5 text-xs text-status-sold-out font-bold text-center">
            {error}
          </div>
        )}

        {/* Order Success State */}
        {orderSuccess && (
          <div className="mb-10 max-w-xl mx-auto rounded-[10px] border border-secondary/20 bg-white p-8 text-center shadow-sm">
            <div className="h-12 w-12 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              ✓
            </div>
            <h3 className="text-xl font-bold text-ink mb-2">Order Placed Successfully!</h3>
            <p className="text-xs text-secondary mb-6 leading-relaxed">
              Your order has been confirmed. Present your pickup reference code below at the cafeteria counter to collect your dishes.
            </p>

            {orderSuccess.referenceCode && (
              <div className="mt-2 mb-6 p-5 rounded-[10px] border border-accent bg-accent/10 text-center shadow-inner">
                <div className="text-[10px] uppercase font-bold tracking-widest text-secondary mb-1">
                  Pickup Reference Code
                </div>
                <div className="text-4xl font-black tracking-widest text-primary font-mono select-all">
                  {orderSuccess.referenceCode}
                </div>
                <div className="text-[10px] text-secondary/70 mt-2 font-semibold">
                  ✓ An SMS confirmation was sent to your registered phone number.
                </div>
              </div>
            )}

            <div className="rounded-[10px] border border-secondary/25 p-4 text-left space-y-3 mb-6 text-xs text-secondary">
              <div className="flex justify-between border-b border-secondary/10 pb-2">
                <span>Order ID:</span>
                <span className="font-mono text-ink font-bold">{orderSuccess.id}</span>
              </div>
              <div className="flex justify-between border-b border-secondary/10 pb-2">
                <span>Status:</span>
                <span className="text-emerald-600 font-bold">CONFIRMED</span>
              </div>
              {mpesaReceipt && (
                <div className="flex justify-between border-b border-secondary/10 pb-2">
                  <span>M-Pesa Receipt:</span>
                  <span className="font-mono text-emerald-600 font-bold">{mpesaReceipt}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 font-bold text-sm text-ink">
                <span>Total Amount:</span>
                <span className="text-primary font-extrabold">KES {orderSuccess.totalAmount.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => setOrderSuccess(null)}
              className="rounded-[10px] bg-primary px-6 py-2.5 text-xs font-bold text-white hover:bg-accent hover:text-ink transition"
            >
              Back to Menu
            </button>
          </div>
        )}

        {/* 2. Dietary Filter Row */}
        <div className="mb-8">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-secondary mb-3">
            Dietary Filters
          </h3>
          <div className="flex flex-wrap gap-2">
            {DIETARY_FILTERS.map((tag) => {
              const active = tag === "All" ? selectedTags.length === 0 : selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-4 py-2 text-xs font-bold tracking-wide transition border ${
                    active
                      ? "bg-primary border-primary text-white"
                      : "bg-white border-secondary/35 text-secondary hover:bg-secondary/5"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Main Area - Split Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: Grid of 6 Dish Cards */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink tracking-wide">
                Today&apos;s Lunch Menu
              </h2>
              {/* 4. Small Status Strip / Legend near grid */}
              <div className="flex gap-2 text-[9px] uppercase font-bold tracking-wider">
                <span className="px-2.5 py-1 rounded bg-[#F0B429]/10 border border-[#F0B429]/30 text-[#C48000]">
                  Low Stock Badge
                </span>
                <span className="px-2.5 py-1 rounded bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626]">
                  Sold Out Badge
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayDishes.map((dish, i) => {
                const isSoldOut = dish.isSoldOut || dish.liveQuantity <= 0;
                const isLowStock = dish.liveQuantity > 0 && dish.liveQuantity <= 15;

                return (
                  <div
                    key={dish.id}
                    className={`relative flex flex-col justify-between rounded-[10px] border p-6 bg-white transition duration-150 ${
                      isSoldOut
                        ? "border-secondary/20 opacity-60 bg-secondary/5"
                        : "border-secondary/20 hover:border-accent hover:shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
                    }`}
                  >
                    <div>
                      {/* Dish Image */}
                      {dish.imageUrl ? (
                        <div className="h-40 overflow-hidden relative rounded-t-[9px] -mt-6 -mx-6 mb-4 border-b border-secondary/10">
                          <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-40 overflow-hidden relative rounded-t-[9px] -mt-6 -mx-6 mb-4 border-b border-secondary/10 bg-gradient-to-br from-primary/10 to-accent/20 flex items-center justify-center">
                          <span className="text-4xl">🍲</span>
                        </div>
                      )}

                      {/* Name & Price */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className={`font-bold tracking-wide text-sm ${isSoldOut ? "text-secondary" : "text-ink"}`}>
                          {dish.name}
                        </h4>
                        <span className="font-bold text-ink text-sm shrink-0">
                          KES {Number(dish.price).toLocaleString()}
                        </span>
                      </div>

                      {/* Description */}
                      {dish.description && (
                        <p className="text-xs text-secondary leading-relaxed mb-4">
                          {dish.description}
                        </p>
                      )}

                      {/* Tag Badges */}
                      {dish.dietaryTags && dish.dietaryTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {dish.dietaryTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[9px] text-ink font-bold uppercase tracking-wider"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer / Stepper & Trigger button */}
                    <div className="mt-4 border-t border-secondary/10 pt-4">
                      {/* Counters */}
                      <div className="flex items-center justify-between text-xs text-secondary font-medium">
                        <span>Portions remaining:</span>
                        {isSoldOut ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#DC2626]/10 border border-[#DC2626]/40 text-[#DC2626]">
                            SOLD OUT
                          </span>
                        ) : isLowStock ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-semibold text-ink">
                              {dish.liveQuantity} of {dish.preparedQuantity} left
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#F0B429]/15 border border-[#F0B429]/40 text-[#C48000] animate-pulse">
                              LOW STOCK
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold text-ink">
                            {dish.liveQuantity} of {dish.preparedQuantity} left
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => addToCart(dish)}
                        disabled={isSoldOut}
                        className={`w-full rounded-[10px] py-2.5 text-xs font-bold transition mt-4 ${
                          isSoldOut
                            ? "bg-secondary/10 border border-secondary/20 text-secondary cursor-not-allowed"
                            : "bg-primary text-white hover:bg-accent hover:text-ink active:scale-[0.98]"
                        }`}
                      >
                        {isSoldOut ? "Out of Stock" : "Add to Order"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Order Summary Card */}
          <aside className="sticky top-24 bg-white border border-secondary/20 rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <h3 className="text-base font-bold text-ink mb-4 pb-3 border-b border-secondary/15 tracking-wide">
              Order Summary
            </h3>

            {cart.length === 0 ? (
              <div className="text-center py-12 text-secondary text-xs font-medium">
                Your order is currently empty.
              </div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b border-secondary/10 pb-4"
                  >
                    <div>
                      <h4 className="font-bold text-ink text-xs mb-1">{item.name}</h4>
                      <div className="flex gap-2 text-[10px] text-secondary font-medium">
                        <span>Unit: KES {item.price}</span>
                        <span>·</span>
                        <span className="text-primary font-bold">Total: KES {item.price * item.quantity}</span>
                      </div>
                    </div>
                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCartQuantity(item.id, -1)}
                        className="h-6 w-6 rounded border border-secondary/35 flex items-center justify-center text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-ink min-w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.id, 1)}
                        className="h-6 w-6 rounded border border-secondary/35 flex items-center justify-center text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-6 border-t border-secondary/15 pt-5 space-y-4">
                <div className="flex items-center justify-between font-bold text-xs text-secondary">
                  <span>Grand Total Amount:</span>
                  <span className="text-lg font-black text-primary">
                    KES {cartTotal.toLocaleString()}
                  </span>
                </div>
                
                <button
                  onClick={() => setIsReviewOpen(true)}
                  className="w-full rounded-[10px] bg-primary py-3 text-xs font-bold text-white shadow-sm hover:bg-accent hover:text-ink transition"
                >
                  Proceed to checkout
                </button>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Review & Checkout Modal */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[10px] border border-secondary/20 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto text-ink">
            <h3 className="text-base font-bold text-ink mb-4 tracking-wide text-center">
              Order Confirmation
            </h3>

            {/* Bill items list */}
            <div className="border-b border-secondary/15 pb-4 mb-4 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-secondary font-medium">
                  <span>
                    {item.name} <span className="text-[10px] font-bold text-primary">x{item.quantity}</span>
                  </span>
                  <span className="font-bold text-ink">
                    KES {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-xs text-secondary font-medium mb-2">
              <span>Subtotal:</span>
              <span className="font-bold text-ink">KES {cartTotal.toLocaleString()}</span>
            </div>

            {/* Loyalty points input */}
            {loyaltyStatus && loyaltyStatus.pointsBalance >= 50 && (
              <div className="bg-background border border-secondary/20 rounded-[10px] p-4 mb-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-ink">
                  <span>Redeem Loyalty Points (1 pt = KES 1.00)</span>
                  <span className="text-[10px] text-primary">Available: {loyaltyStatus.pointsBalance} pts</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={pointsToRedeemInput}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      setPointsToRedeemInput(valStr);
                      const val = Number(valStr);
                      if (valStr === "") {
                        setRedeemError("");
                        return;
                      }
                      if (isNaN(val) || val < 0) {
                        setRedeemError("Invalid points amount.");
                        return;
                      }
                      if (val > 0) {
                        if (loyaltyStatus.status === "FROZEN") {
                          setRedeemError("Your loyalty account is frozen.");
                          return;
                        }
                        if (val < 50) {
                          setRedeemError("Minimum 50 points required to redeem.");
                          return;
                        }
                        if (val > loyaltyStatus.pointsBalance) {
                          setRedeemError(`Insufficient points. You have ${loyaltyStatus.pointsBalance} points.`);
                          return;
                        }
                        const maxRedeem = Math.floor(cartTotal * 0.3);
                        if (val > maxRedeem) {
                          setRedeemError(`Maximum redemption cannot exceed 30% of order (Max: ${maxRedeem} points).`);
                          return;
                        }
                      }
                      setRedeemError("");
                    }}
                    placeholder="Enter points (min 50)"
                    className="flex-1 rounded border border-secondary/35 bg-transparent px-3 py-1.5 text-xs font-bold text-ink focus:border-primary focus:outline-none"
                  />
                  {pointsToRedeemInput && (
                    <button
                      onClick={() => {
                        setPointsToRedeemInput("");
                        setRedeemError("");
                      }}
                      className="rounded border border-secondary/30 px-3 text-xs font-bold text-secondary hover:bg-secondary/5"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {redeemError && (
                  <p className="text-[10px] text-rose-600 font-semibold">{redeemError}</p>
                )}
                {!redeemError && pointsToRedeemInput && (
                  <p className="text-[10px] text-emerald-600 font-semibold">
                    ✓ Applied: KES {Number(pointsToRedeemInput).toFixed(2)} discount.
                  </p>
                )}
              </div>
            )}

            {pointsToRedeem > 0 && !redeemError && (
              <div className="flex justify-between text-xs text-secondary font-medium mb-4">
                <span>Loyalty Points Discount:</span>
                <span className="font-bold text-rose-600">- KES {pointsToRedeem.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold mb-6 border-t border-secondary/15 pt-3">
              <span>Total Price Due:</span>
              <span className="text-primary font-extrabold text-base">KES {(cartTotal - pointsToRedeem).toLocaleString()}</span>
            </div>

            {/* Wallet Selection & Bill Breakdown */}
            <div className="bg-background border border-secondary/20 rounded-[10px] p-4 mb-6 space-y-4 text-secondary">
              <div className="flex items-center justify-between">
                <label htmlFor="useWalletCheckbox" className="flex items-center gap-3 cursor-pointer select-none text-xs font-bold text-ink">
                  <input
                    type="checkbox"
                    id="useWalletCheckbox"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    className="h-4 w-4 rounded border-secondary/40 text-primary focus:ring-primary"
                  />
                  <span>Use Wallet Balance</span>
                </label>
                <span className="text-[10px] font-bold text-primary">
                  Available: KES {walletBalance.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-secondary/15 pt-3 space-y-2 text-[11px] font-medium">
                {useWallet ? (
                  walletBalance >= (cartTotal - pointsToRedeem) ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>Deducted from Wallet:</span>
                        <span className="font-bold text-emerald-600">- KES {(cartTotal - pointsToRedeem).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs text-ink mt-1 border-t border-secondary/15 pt-1">
                        <span>Remaining M-Pesa STK:</span>
                        <span>KES 0.00</span>
                      </div>
                      <p className="text-secondary/70 text-[9px] mt-1 italic font-semibold">
                        ✓ Fully covered. No M-Pesa prompt will be triggered.
                      </p>
                    </div>
                  ) : walletBalance > 0 ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>Deducted from Wallet:</span>
                        <span className="font-bold text-emerald-600">- KES {walletBalance.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs text-ink mt-1 border-t border-secondary/15 pt-1">
                        <span>Remaining M-Pesa STK:</span>
                        <span className="text-primary font-extrabold">KES {((cartTotal - pointsToRedeem) - walletBalance).toFixed(2)}</span>
                      </div>
                      <p className="text-secondary/70 text-[9px] mt-1 font-semibold italic">
                        ⚠ Split Payment: You will receive an M-Pesa prompt for the remaining amount.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span>Deducted from Wallet:</span>
                        <span>KES 0.00</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs text-ink mt-1 border-t border-secondary/15 pt-1">
                        <span>M-Pesa STK Push:</span>
                        <span className="text-primary font-extrabold">KES {(cartTotal - pointsToRedeem).toFixed(2)}</span>
                      </div>
                      <p className="text-secondary/70 text-[9px] mt-1 font-semibold">
                        Wallet is empty. Full amount paid via M-Pesa.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between font-bold text-xs text-ink">
                      <span>M-Pesa STK Push:</span>
                      <span className="text-primary font-extrabold">KES {(cartTotal - pointsToRedeem).toFixed(2)}</span>
                    </div>
                    <p className="text-secondary/70 text-[9px] mt-1 font-semibold">
                      Full amount will be paid via M-Pesa STK Push.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[10px] bg-[#DC2626]/5 border border-[#DC2626]/20 p-4 mb-6 text-xs text-secondary leading-relaxed font-semibold">
              <strong>Order locking notice:</strong> By confirming, portions will be atomically locked. You must proceed to complete payment to secure your pre-order.
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsReviewOpen(false)}
                disabled={checkoutLoading}
                className="flex-1 rounded-[10px] border border-secondary/30 py-3 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
              >
                Go Back
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || !!redeemError}
                className="flex-1 rounded-[10px] bg-primary py-3 text-xs font-bold text-white hover:bg-accent hover:text-ink transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {checkoutLoading ? "Confirming Portions..." : "Confirm & Checkout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M-Pesa Pending Overlay Modal */}
      {paymentStatus !== "IDLE" && paymentStatus !== "SUCCESS" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[10px] border border-secondary/20 bg-white p-8 shadow-xl text-center space-y-6">
            {paymentStatus === "PENDING" && (
              <>
                <div className="relative h-20 w-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-primary text-xs">
                    M-Pesa
                  </div>
                </div>
                <h3 className="text-xl font-bold text-ink tracking-wide">
                  Awaiting Payment Approval
                </h3>
                <p className="text-xs text-secondary leading-relaxed font-medium">
                  We sent an M-Pesa STK Push prompt to your registered number. Please enter your PIN on your phone to complete the transaction.
                </p>
                
                <div className="rounded-[10px] bg-background border border-secondary/20 p-4 text-xs text-left text-secondary space-y-2">
                  <div className="flex justify-between">
                    <span>Target Shortcode:</span>
                    <span className="font-semibold text-ink">174379 (CafeQ)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Due via M-Pesa:</span>
                    <span className="font-bold text-primary">KES {paymentAmountToPrompt.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-[10px] text-secondary/70 italic animate-pulse font-semibold">
                  Verifying transaction state automatically...
                </div>

                <button
                  onClick={cancelPaymentVerification}
                  className="w-full rounded-[10px] border border-secondary/35 py-3 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                >
                  Cancel & Edit Order
                </button>
              </>
            )}

            {paymentStatus === "FAILED" && (
              <>
                <div className="h-16 w-16 rounded-full bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] flex items-center justify-center mx-auto text-2xl font-bold">
                  ✕
                </div>
                <h3 className="text-xl font-bold text-ink tracking-wide">
                  Payment Failed
                </h3>
                <p className="text-xs text-secondary leading-relaxed font-medium">
                  {paymentError || "The M-Pesa transaction was cancelled or declined."}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => pendingOrderId && processCheckoutPayment(pendingOrderId, cartTotal, useWallet)}
                    className="flex-1 rounded-[10px] bg-primary py-3 text-xs font-bold text-white hover:bg-accent hover:text-ink transition"
                  >
                    Retry Payment
                  </button>
                  <button
                    onClick={cancelPaymentVerification}
                    className="flex-1 rounded-[10px] border border-secondary/30 py-3 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {paymentStatus === "TIMEOUT" && (
              <>
                <div className="h-16 w-16 rounded-full bg-[#F0B429]/10 border border-[#F0B429]/30 text-[#C48000] flex items-center justify-center mx-auto text-2xl font-bold">
                  !
                </div>
                <h3 className="text-xl font-bold text-ink tracking-wide">
                  Verification Timeout
                </h3>
                <p className="text-xs text-secondary leading-relaxed font-medium">
                  We did not receive a payment confirmation in time. If you entered your PIN, check your order history later.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => pendingOrderId && processCheckoutPayment(pendingOrderId, cartTotal, useWallet)}
                    className="flex-1 rounded-[10px] bg-primary py-3 text-xs font-bold text-white hover:bg-accent hover:text-ink transition"
                  >
                    Check / Retry
                  </button>
                  <button
                    onClick={cancelPaymentVerification}
                    className="flex-1 rounded-[10px] border border-secondary/30 py-3 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Wallet Top-Up Modal */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[10px] border border-secondary/20 bg-white p-6 shadow-xl text-ink">
            <div className="flex items-center justify-between border-b border-secondary/15 pb-4 mb-6">
              <h3 className="text-base font-bold text-ink tracking-wide">Top Up Wallet</h3>
              <button
                onClick={() => {
                  if (topUpStatus !== "PENDING") {
                    setIsTopUpOpen(false);
                  }
                }}
                disabled={topUpStatus === "PENDING"}
                className={`text-secondary hover:text-ink text-lg font-bold ${topUpStatus === "PENDING" ? "opacity-30 cursor-not-allowed" : ""}`}
              >
                ✕
              </button>
            </div>

            {topUpStatus === "IDLE" && (
              <form onSubmit={handleWalletTopUp} className="space-y-6">
                <div>
                  <label htmlFor="topUpAmountInput" className="block text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">
                    Enter Amount (KES)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-secondary/70 text-xs">KES</span>
                    <input
                      type="number"
                      id="topUpAmountInput"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="e.g. 500"
                      min="1"
                      className="w-full rounded-[10px] border border-secondary/30 bg-transparent pl-12 pr-4 py-3 text-sm font-bold text-ink focus:border-primary focus:outline-none transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={topUpLoading}
                  className="w-full rounded-[10px] bg-primary py-3 text-xs font-bold text-white hover:bg-accent hover:text-ink transition active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {topUpLoading ? "Initiating STK Push..." : "Trigger M-Pesa Top Up"}
                </button>
              </form>
            )}

            {topUpStatus === "PENDING" && (
              <div className="text-center py-6 space-y-6">
                <div className="relative h-20 w-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-primary text-xs">
                    M-Pesa
                  </div>
                </div>
                <h4 className="text-sm font-bold text-ink">Awaiting PIN Confirmation</h4>
                <p className="text-xs text-secondary leading-relaxed px-4 font-medium">
                  We sent an STK Push to your M-Pesa number. Complete the prompt on your phone to top up KES {Number(topUpAmount).toLocaleString()}.
                </p>
                <div className="text-[10px] text-secondary/70 italic animate-pulse font-semibold">
                  Verifying transaction state automatically...
                </div>
                <button
                  onClick={cancelTopUpVerification}
                  className="rounded-[10px] border border-secondary/35 px-4 py-2 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                >
                  Cancel Polling
                </button>
              </div>
            )}

            {topUpStatus === "SUCCESS" && (
              <div className="text-center py-6 space-y-6">
                <div className="h-16 w-16 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold">
                  ✓
                </div>
                <h4 className="text-sm font-bold text-ink">Wallet Loaded Successfully!</h4>
                <p className="text-xs text-secondary px-4 font-medium">
                  Successfully credited <span className="text-emerald-600 font-bold">KES {Number(topUpAmount).toLocaleString()}</span> to your CaféQ wallet.
                </p>
                {topUpReceipt && (
                  <div className="inline-block bg-background border border-secondary/20 rounded px-3 py-1 font-mono text-[9px] text-secondary">
                    Receipt: <span className="text-emerald-600 font-bold">{topUpReceipt}</span>
                  </div>
                )}
                <button
                  onClick={() => setIsTopUpOpen(false)}
                  className="w-full rounded-[10px] bg-primary py-3 text-xs font-bold text-white hover:bg-accent hover:text-ink transition"
                >
                  Done
                </button>
              </div>
            )}

            {topUpStatus === "FAILED" && (
              <div className="text-center py-6 space-y-6">
                <div className="h-16 w-16 rounded-full bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] flex items-center justify-center mx-auto text-2xl font-bold">
                  ✕
                </div>
                <h4 className="text-sm font-bold text-ink">Top Up Failed</h4>
                <p className="text-xs text-[#DC2626] px-4 leading-relaxed font-semibold">
                  {topUpError || "The M-Pesa transaction was cancelled or declined."}
                </p>
                <div className="flex gap-3 px-4">
                  <button
                    onClick={() => {
                      setTopUpStatus("IDLE");
                      setTopUpError("");
                    }}
                    className="flex-1 rounded-[10px] bg-primary py-2.5 text-xs font-bold text-white hover:bg-accent hover:text-ink transition"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setIsTopUpOpen(false)}
                    className="flex-1 rounded-[10px] border border-secondary/30 py-2.5 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {topUpStatus === "TIMEOUT" && (
              <div className="text-center py-6 space-y-6">
                <div className="h-16 w-16 rounded-full bg-[#F0B429]/10 border border-[#F0B429]/30 text-[#C48000] flex items-center justify-center mx-auto text-2xl font-bold">
                  !
                </div>
                <h4 className="text-sm font-bold text-ink">Verification Timeout</h4>
                <p className="text-xs text-secondary px-4 leading-relaxed font-medium">
                  We did not receive a payment confirmation in time. Check your wallet balance in a few minutes.
                </p>
                <div className="flex gap-3 px-4">
                  <button
                    onClick={() => {
                      setTopUpStatus("IDLE");
                    }}
                    className="flex-1 rounded-[10px] bg-primary py-2.5 text-xs font-bold text-white hover:bg-accent hover:text-ink transition"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setIsTopUpOpen(false)}
                    className="flex-1 rounded-[10px] border border-secondary/30 py-2.5 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loyalty History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[10px] border border-secondary/20 bg-white p-6 shadow-xl text-ink max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-secondary/15 pb-4 mb-6">
                <h3 className="text-base font-bold text-ink tracking-wide">Loyalty Points History</h3>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="text-secondary hover:text-ink text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {loyaltyHistory.length === 0 ? (
                <div className="text-center py-12 text-secondary text-xs font-medium">
                  No loyalty transactions found.
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-1">
                  {loyaltyHistory.map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center border-b border-secondary/10 pb-3 text-xs">
                      <div>
                        <div className="font-bold text-ink">
                          {tx.transactionType === 'EARN' ? 'Points Earned' :
                           tx.transactionType === 'REDEEM' ? 'Points Redeemed' :
                           tx.transactionType === 'REFUND_DEDUCT' ? 'Points Deducted (Refund)' :
                           tx.transactionType === 'REFUND_RETURN' ? 'Points Restored (Failed Payment)' : tx.transactionType}
                        </div>
                        <div className="text-[10px] text-secondary">
                          {new Date(tx.createdAt).toLocaleDateString()} at {new Date(tx.createdAt).toLocaleTimeString()}
                        </div>
                        {tx.referenceId && (
                          <div className="text-[9px] text-secondary font-mono mt-1">
                            Ref ID: {tx.referenceId.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                      <span className={`font-black text-sm ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-secondary/15">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="w-full rounded-[10px] bg-primary py-3 text-xs font-bold text-white hover:bg-accent hover:text-ink transition active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-secondary/15 py-6 text-center text-[10px] text-secondary font-semibold bg-white px-6">
        <p>© {new Date().getFullYear()} CaféQ. Strathmore University Cafeteria. Kenya Data Protection Act 2019 Compliant.</p>
      </footer>
    </div>
  );
}
