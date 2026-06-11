"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  dietaryTags: string[] | null;
  preparedQuantity: number;
  liveQuantity: number;
  isSoldOut: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  // Cart and checkout states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser) as User;
    Promise.resolve().then(() => {
      setUser(parsedUser);
    }).catch(() => {});

    // Fetch initial wallet balance
    Promise.resolve().then(() => {
      void fetchWalletBalance();
    }).catch(() => {});

    const fetchMenu = async () => {
      try {
        const queryParams = selectedTags.length > 0 
          ? `?tags=${selectedTags.join(",")}` 
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

    // Initial load and start interval
    const fetchMenuAndSetup = async () => {
      await fetchMenu();
    };
    void fetchMenuAndSetup();
    const interval = setInterval(fetchMenu, 5000);

    return () => clearInterval(interval);
  }, [selectedTags, router]);

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
    setIsCartOpen(true);
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
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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

      // Start polling for payment status by payment ID
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
        void fetchWalletBalance();
      } else {
        // Start status polling
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
                void fetchWalletBalance();
              } else if (statusData.status === "FAILED") {
                clearInterval(interval);
                setPaymentStatus("FAILED");
                setPaymentError("Payment failed or was cancelled.");
                void fetchWalletBalance();
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create order");
      }

      // Order created successfully
      const createdOrder = data;
      setPendingOrderId(createdOrder.id);
      setIsReviewOpen(false);
      setIsCartOpen(false);

      // Trigger unified pay flow
      void processCheckoutPayment(createdOrder.id, Number(createdOrder.totalAmount), useWallet);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Checkout failed. Portions may have changed.";
      setError(errMsg);
      setIsReviewOpen(false);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const paymentAmountToPrompt = (useWallet && walletBalance > 0)
    ? Math.max(0, cartTotal - walletBalance)
    : cartTotal;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C59B27] border-t-transparent mx-auto mb-4"></div>
          <p className="text-zinc-400 text-sm">Assembling live menu portions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#140404] to-black text-white font-sans relative overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Café<span className="text-[#C59B27]">Q</span>
            </h1>
            {user && (
              <p className="text-xs text-zinc-400 mt-0.5">
                Welcome back, <span className="text-[#C59B27]">{user.fullName}</span> ({user.role})
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs">
                <span className="text-zinc-400">Wallet:</span>
                <span className="text-[#C59B27] font-bold">KES {walletBalance.toFixed(2)}</span>
                <button
                  onClick={() => {
                    setIsTopUpOpen(true);
                    setTopUpStatus("IDLE");
                    setTopUpAmount("");
                  }}
                  className="ml-1 bg-[#C59B27] text-black text-[10px] font-bold px-2 py-1 rounded hover:brightness-110 active:scale-95 transition"
                >
                  Top Up
                </button>
              </div>
            )}
            <button
              onClick={() => setIsCartOpen(!isCartOpen)}
              className="relative rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10 transition"
            >
              Cart ({cartItemsCount})
              {cartItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[#7A1C1C] text-[9px] flex items-center justify-center font-bold">
                  {cartItemsCount}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-950/20 border border-red-500/30 p-3 text-sm text-red-200 text-center">
            {error}
          </div>
        )}

        {/* Order Success State */}
        {orderSuccess && (
          <div className="mb-10 max-w-xl mx-auto rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-8 text-center backdrop-blur-md">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 text-xl">
              ✓
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Order Placed Successfully!</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Your order has been confirmed. Present your pickup reference code below at the cafeteria counter to collect your dishes.
            </p>

            {orderSuccess.referenceCode && (
              <div className="mt-2 mb-6 p-5 rounded-2xl border border-[#C59B27]/30 bg-gradient-to-r from-[#C59B27]/5 to-[#C59B27]/10 text-center shadow-inner">
                <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-1">
                  Pickup Reference Code
                </div>
                <div className="text-4xl font-black tracking-widest text-[#C59B27] font-mono select-all">
                  {orderSuccess.referenceCode}
                </div>
                <div className="text-[10px] text-zinc-500 mt-2 font-medium">
                  ✓ An SMS confirmation was sent to your registered phone number.
                </div>
              </div>
            )}

            <div className="rounded-lg bg-white/5 border border-white/5 p-4 text-left space-y-3 mb-6 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2 text-xs text-zinc-400">
                <span>Order ID:</span>
                <span className="font-mono text-white">{orderSuccess.id}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2 text-xs text-zinc-400">
                <span>Status:</span>
                <span className="text-emerald-400 font-semibold">{orderSuccess.status}</span>
              </div>
              {mpesaReceipt && (
                <div className="flex justify-between border-b border-white/5 pb-2 text-xs text-zinc-400">
                  <span>M-Pesa Receipt:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{mpesaReceipt}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 font-bold text-base">
                <span>Total Amount:</span>
                <span className="text-[#C59B27]">KES {orderSuccess.totalAmount.toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => setOrderSuccess(null)}
              className="rounded-lg bg-[#C59B27] px-6 py-2.5 text-xs font-bold text-black hover:brightness-110 transition"
            >
              Back to Menu
            </button>
          </div>
        )}

        {/* Dietary Filters */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Dietary Filters
          </h3>
          <div className="flex flex-wrap gap-2">
            {DIETARY_FILTERS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold tracking-wide transition border ${
                    active
                      ? "bg-[#7A1C1C] border-[#7A1C1C] text-white"
                      : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Menu Section */}
        {!menu ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 bg-white/5">
            <h2 className="text-lg font-semibold text-zinc-400">No active menu published for today</h2>
            <p className="text-sm text-zinc-500 mt-2">Check back during serving hours.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Today&apos;s Active Menu
              </h2>
              <span className="rounded-full bg-emerald-950/40 border border-emerald-500/40 px-3 py-1 text-xs text-emerald-400 font-semibold">
                Live Portions Active
              </span>
            </div>

            {/* Dish Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menu.dishes.map((dish) => {
                const isSoldOut = dish.isSoldOut || dish.liveQuantity <= 0;
                const lowStock = dish.liveQuantity > 0 && dish.liveQuantity <= 20;

                return (
                  <div
                    key={dish.id}
                    className={`relative flex flex-col justify-between rounded-xl border p-6 transition duration-200 ${
                      isSoldOut
                        ? "border-white/5 bg-white/2 opacity-60"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-white tracking-wide text-base">
                          {dish.name}
                        </h4>
                        <span className="font-bold text-[#C59B27] text-base">
                          KES {Number(dish.price).toLocaleString()}
                        </span>
                      </div>

                      {dish.description && (
                        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                          {dish.description}
                        </p>
                      )}

                      {dish.dietaryTags && dish.dietaryTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {dish.dietaryTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-[#7A1C1C]/20 border border-[#7A1C1C]/40 px-2 py-0.5 text-[10px] text-[#ff7b7b] uppercase font-bold tracking-wider"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-4">
                        <span className="text-xs text-zinc-400">Available portions:</span>
                        {isSoldOut ? (
                          <span className="rounded bg-red-950/40 border border-red-500/40 px-2 py-1 text-xs font-bold text-red-400">
                            Sold Out
                          </span>
                        ) : lowStock ? (
                          <span className="rounded bg-amber-950/40 border border-amber-500/40 px-2 py-1 text-xs font-bold text-amber-400 animate-pulse">
                            Only {dish.liveQuantity} left!
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-950/40 border border-emerald-500/40 px-2 py-1 text-xs font-bold text-emerald-400">
                            {dish.liveQuantity} portions
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => addToCart(dish)}
                        disabled={isSoldOut}
                        className={`w-full rounded-lg py-2.5 text-xs font-bold transition mt-4 ${
                          isSoldOut
                            ? "bg-white/5 border border-white/10 text-zinc-500 cursor-not-allowed"
                            : "bg-white/10 hover:bg-[#C59B27] hover:text-black hover:shadow-lg active:scale-[0.98]"
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
        )}
      </main>

      {/* Cart Side Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-zinc-950 border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl animate-slide-in">
            <div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                <h3 className="text-lg font-bold text-white tracking-wide">Your Cart</h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-zinc-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-sm text-zinc-500">Your cart is empty.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border-b border-white/5 pb-4"
                    >
                      <div>
                        <h4 className="font-semibold text-white text-sm">{item.name}</h4>
                        <p className="text-xs text-zinc-500 mt-1">
                          KES {item.price.toLocaleString()} each
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateCartQuantity(item.id, -1)}
                          className="h-6 w-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-xs hover:bg-white/10 transition"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="h-6 w-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-xs hover:bg-white/10 transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-white/5 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Total running amount:</span>
                  <span className="text-lg font-bold text-[#C59B27]">
                    KES {cartTotal.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => setIsReviewOpen(true)}
                  className="w-full rounded-lg bg-gradient-to-r from-[#7A1C1C] to-[#C59B27] py-3 text-sm font-bold text-white shadow-lg hover:brightness-110 transition"
                >
                  Review Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review & Checkout Modal */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4 tracking-wide text-center">
              Order Review Summary
            </h3>

            {/* Bill items list */}
            <div className="border-b border-white/5 pb-4 mb-4 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-zinc-400">
                    {item.name} <span className="text-xs text-zinc-500">x{item.quantity}</span>
                  </span>
                  <span className="font-semibold">
                    KES {(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-base font-bold mb-6">
              <span>Total Price Due:</span>
              <span className="text-[#C59B27]">KES {cartTotal.toLocaleString()}</span>
            </div>

            {/* Wallet Selection & Bill Breakdown */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 space-y-4">
              <div className="flex items-center justify-between">
                <label htmlFor="useWalletCheckbox" className="flex items-center gap-3 cursor-pointer select-none text-sm font-semibold">
                  <input
                    type="checkbox"
                    id="useWalletCheckbox"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-[#C59B27] focus:ring-[#C59B27]"
                  />
                  <span>Use Wallet Balance</span>
                </label>
                <span className="text-xs text-zinc-400">
                  Available: KES {walletBalance.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-white/5 pt-3 space-y-2 text-xs">
                {useWallet ? (
                  walletBalance >= cartTotal ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-zinc-400">
                        <span>Deducted from Wallet:</span>
                        <span className="font-semibold text-emerald-400">- KES {cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-white mt-1 border-t border-white/5 pt-1">
                        <span>Remaining M-Pesa STK:</span>
                        <span>KES 0.00</span>
                      </div>
                      <p className="text-zinc-500 text-[10px] mt-1">
                        ✓ Fully covered. No M-Pesa prompt will be triggered.
                      </p>
                    </div>
                  ) : walletBalance > 0 ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-zinc-400">
                        <span>Deducted from Wallet:</span>
                        <span className="font-semibold text-emerald-400">- KES {walletBalance.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-white mt-1 border-t border-white/5 pt-1">
                        <span>Remaining M-Pesa STK:</span>
                        <span className="text-[#C59B27]">KES {(cartTotal - walletBalance).toFixed(2)}</span>
                      </div>
                      <p className="text-zinc-500 text-[10px] mt-1">
                        ⚠ Split Payment: You will receive an M-Pesa prompt for the remaining amount.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-zinc-400">
                        <span>Deducted from Wallet:</span>
                        <span>KES 0.00</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-white mt-1 border-t border-white/5 pt-1">
                        <span>M-Pesa STK Push:</span>
                        <span className="text-[#C59B27]">KES {cartTotal.toFixed(2)}</span>
                      </div>
                      <p className="text-zinc-500 text-[10px] mt-1">
                        Wallet is empty. Full amount paid via M-Pesa.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between font-bold text-sm text-white">
                      <span>M-Pesa STK Push:</span>
                      <span className="text-[#C59B27]">KES {cartTotal.toFixed(2)}</span>
                    </div>
                    <p className="text-zinc-500 text-[10px] mt-1">
                      Full amount will be paid via M-Pesa STK Push.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-[#7A1C1C]/10 border border-[#7A1C1C]/30 p-4 mb-6 text-xs text-zinc-300 leading-relaxed">
              <strong>Order locking notice:</strong> By confirming, portions will be atomically locked. You must proceed to complete payment to secure your pre-order.
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsReviewOpen(false)}
                disabled={checkoutLoading}
                className="flex-1 rounded-lg border border-white/10 py-3 text-xs font-bold text-zinc-400 hover:bg-white/5 transition"
              >
                Go Back
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="flex-1 rounded-lg bg-[#C59B27] py-3 text-xs font-bold text-black hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                {checkoutLoading ? "Confirming Portions..." : "Confirm & Checkout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M-Pesa Pending Overlay Modal */}
      {paymentStatus !== "IDLE" && paymentStatus !== "SUCCESS" && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-8 shadow-2xl text-center space-y-6 animate-fade-in">
            {paymentStatus === "PENDING" && (
              <>
                <div className="relative h-20 w-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-[#C59B27] border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-[#C59B27] text-xs">
                    M-Pesa
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white tracking-wide">
                  Awaiting Payment Approval
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We&apos;ve sent an M-Pesa STK Push prompt to your registered number. Please enter your PIN on your phone to complete the transaction.
                </p>
                
                <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/20 p-4 text-xs text-left text-zinc-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Target Shortcode:</span>
                    <span className="font-semibold text-emerald-400">174379 (CafeQ)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Due via M-Pesa:</span>
                    <span className="font-semibold text-[#C59B27]">KES {paymentAmountToPrompt.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-xs text-zinc-500 italic animate-pulse">
                  Verifying transaction state automatically...
                </div>

                <button
                  onClick={cancelPaymentVerification}
                  className="w-full rounded-lg border border-white/10 py-3 text-xs font-semibold text-zinc-400 hover:bg-white/5 hover:text-white transition"
                >
                  Cancel & Edit Order
                </button>
              </>
            )}

            {paymentStatus === "FAILED" && (
              <>
                <div className="h-16 w-16 rounded-full bg-red-950/30 border border-red-500/50 text-red-400 flex items-center justify-center mx-auto text-2xl font-bold">
                  ✕
                </div>
                <h3 className="text-xl font-bold text-white tracking-wide">
                  Payment Failed
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {paymentError || "The M-Pesa transaction was cancelled or declined."}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => pendingOrderId && processCheckoutPayment(pendingOrderId, cartTotal, useWallet)}
                    className="flex-1 rounded-lg bg-[#C59B27] py-3 text-xs font-bold text-black hover:brightness-110 transition"
                  >
                    Retry Payment
                  </button>
                  <button
                    onClick={cancelPaymentVerification}
                    className="flex-1 rounded-lg border border-white/10 py-3 text-xs font-bold text-zinc-400 hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {paymentStatus === "TIMEOUT" && (
              <>
                <div className="h-16 w-16 rounded-full bg-amber-950/30 border border-amber-500/50 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
                  !
                </div>
                <h3 className="text-xl font-bold text-white tracking-wide">
                  Verification Timeout
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We did not receive a payment confirmation in time. If you entered your PIN, check your order history later.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => pendingOrderId && processCheckoutPayment(pendingOrderId, cartTotal, useWallet)}
                    className="flex-1 rounded-lg bg-[#C59B27] py-3 text-xs font-bold text-black hover:brightness-110 transition"
                  >
                    Check / Retry
                  </button>
                  <button
                    onClick={cancelPaymentVerification}
                    className="flex-1 rounded-lg border border-white/10 py-3 text-xs font-bold text-zinc-400 hover:bg-white/5 transition"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <h3 className="text-lg font-bold text-white tracking-wide">Top Up Wallet</h3>
              <button
                onClick={() => {
                  if (topUpStatus !== "PENDING") {
                    setIsTopUpOpen(false);
                  }
                }}
                disabled={topUpStatus === "PENDING"}
                className={`text-zinc-400 hover:text-white text-lg font-bold ${topUpStatus === "PENDING" ? "opacity-30 cursor-not-allowed" : ""}`}
              >
                ✕
              </button>
            </div>

            {topUpStatus === "IDLE" && (
              <form onSubmit={handleWalletTopUp} className="space-y-6">
                <div>
                  <label htmlFor="topUpAmountInput" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Enter Amount (KES)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-zinc-500 text-sm">KES</span>
                    <input
                      type="number"
                      id="topUpAmountInput"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="e.g. 500"
                      min="1"
                      className="w-full rounded-lg bg-white/5 border border-white/10 pl-12 pr-4 py-3 text-sm font-semibold text-white focus:border-[#C59B27] focus:outline-none transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={topUpLoading}
                  className="w-full rounded-lg bg-[#C59B27] py-3 text-xs font-bold text-black hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  {topUpLoading ? "Initiating STK Push..." : "Trigger M-Pesa Top Up"}
                </button>
              </form>
            )}

            {topUpStatus === "PENDING" && (
              <div className="text-center py-6 space-y-6">
                <div className="relative h-20 w-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-[#C59B27] border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-[#C59B27] text-xs">
                    M-Pesa
                  </div>
                </div>
                <h4 className="text-base font-bold text-white">Awaiting PIN Confirmation</h4>
                <p className="text-xs text-zinc-400 leading-relaxed px-4">
                  We sent an STK Push to your M-Pesa number. Complete the prompt on your phone to top up KES {Number(topUpAmount).toLocaleString()}.
                </p>
                <div className="text-[10px] text-zinc-500 italic animate-pulse">
                  Verifying transaction state automatically...
                </div>
                <button
                  onClick={cancelTopUpVerification}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition"
                >
                  Cancel Polling
                </button>
              </div>
            )}

            {topUpStatus === "SUCCESS" && (
              <div className="text-center py-6 space-y-6">
                <div className="h-16 w-16 rounded-full bg-emerald-950/30 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto text-2xl font-bold">
                  ✓
                </div>
                <h4 className="text-base font-bold text-white">Wallet Loaded Successfully!</h4>
                <p className="text-xs text-zinc-400 px-4">
                  Successfully credited <span className="text-emerald-400 font-bold">KES {Number(topUpAmount).toLocaleString()}</span> to your CaféQ wallet.
                </p>
                {topUpReceipt && (
                  <div className="inline-block bg-white/5 border border-white/5 rounded px-3 py-1 font-mono text-[10px] text-zinc-300">
                    Receipt: <span className="text-emerald-400 font-semibold">{topUpReceipt}</span>
                  </div>
                )}
                <button
                  onClick={() => setIsTopUpOpen(false)}
                  className="w-full rounded-lg bg-[#C59B27] py-3 text-xs font-bold text-black hover:brightness-110 transition"
                >
                  Done
                </button>
              </div>
            )}

            {topUpStatus === "FAILED" && (
              <div className="text-center py-6 space-y-6">
                <div className="h-16 w-16 rounded-full bg-red-950/30 border border-red-500/50 text-red-400 flex items-center justify-center mx-auto text-2xl font-bold">
                  ✕
                </div>
                <h4 className="text-base font-bold text-white">Top Up Failed</h4>
                <p className="text-xs text-red-300 px-4 leading-relaxed">
                  {topUpError || "The M-Pesa transaction was cancelled or declined."}
                </p>
                <div className="flex gap-3 px-4">
                  <button
                    onClick={() => {
                      setTopUpStatus("IDLE");
                      setTopUpError("");
                    }}
                    className="flex-1 rounded-lg bg-[#C59B27] py-2.5 text-xs font-bold text-black hover:brightness-110 transition"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setIsTopUpOpen(false)}
                    className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs font-bold text-zinc-400 hover:bg-white/5 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {topUpStatus === "TIMEOUT" && (
              <div className="text-center py-6 space-y-6">
                <div className="h-16 w-16 rounded-full bg-amber-950/30 border border-amber-500/50 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
                  !
                </div>
                <h4 className="text-base font-bold text-white">Verification Timeout</h4>
                <p className="text-xs text-zinc-400 px-4 leading-relaxed">
                  We did not receive a payment confirmation in time. Check your wallet balance in a few minutes.
                </p>
                <div className="flex gap-3 px-4">
                  <button
                    onClick={() => {
                      setTopUpStatus("IDLE");
                    }}
                    className="flex-1 rounded-lg bg-[#C59B27] py-2.5 text-xs font-bold text-black hover:brightness-110 transition"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setIsTopUpOpen(false)}
                    className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs font-bold text-zinc-400 hover:bg-white/5 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
