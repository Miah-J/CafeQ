"use client";

import { useEffect, useState, useCallback } from "react";
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

interface StudentLookup {
  found: boolean;
  id?: string;
  fullName?: string;
  studentNumber?: string;
}

interface CashierOrderResult {
  order: {
    id: string;
    totalAmount: number;
    status: string;
  };
  referenceCode?: string;
  paymentStatus: "SUCCESS" | "PENDING";
}

const DIETARY_FILTERS = ["Halal", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"];

export default function CashierWorkspace() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Student lookup
  const [studentNumberInput, setStudentNumberInput] = useState("");
  const [studentLookup, setStudentLookup] = useState<StudentLookup | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MPESA">("CASH");

  // Order result
  const [orderResult, setOrderResult] = useState<CashierOrderResult | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState("");

  // M-Pesa polling
  const [mpesaPollStatus, setMpesaPollStatus] = useState<"IDLE" | "POLLING" | "SUCCESS" | "FAILED" | "TIMEOUT">("IDLE");
  const [mpesaReferenceCode, setMpesaReferenceCode] = useState("");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser) as User;
    if (parsedUser.role !== "Cashier") {
      router.push("/menu");
      return;
    }
    Promise.resolve().then(() => {
      setUser(parsedUser);
    }).catch(() => {});
    const fetchMenu = async () => {
      try {
        const queryParams = selectedTags.length > 0
          ? `?tags=${selectedTags.join(",")}`
          : "";

        const res = await fetch(`http://localhost:3001/menus/active${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` },
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
        }
      } catch {
        // Polling will retry
      } finally {
        setLoading(false);
      }
    };

    void fetchMenu();
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

  // Student lookup
  const handleStudentLookup = useCallback(async () => {
    if (!studentNumberInput.trim()) {
      setStudentLookup(null);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    setStudentLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/orders/student/${studentNumberInput.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStudentLookup(data);
    } catch {
      setStudentLookup({ found: false });
    } finally {
      setStudentLoading(false);
    }
  }, [studentNumberInput]);

  // Place cashier order
  const handlePlaceOrder = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    if (cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    if (paymentMethod === "MPESA" && (!studentLookup || !studentLookup.found)) {
      alert("M-Pesa payment requires a valid student number for the STK push.");
      return;
    }

    setOrderLoading(true);
    setOrderError("");
    setMpesaPollStatus("IDLE");
    setMpesaReferenceCode("");

    try {
      const body: Record<string, unknown> = {
        paymentMethod,
        items: cart.map((item) => ({
          dishId: item.id,
          quantity: item.quantity,
        })),
      };

      if (studentLookup?.found && studentLookup.studentNumber) {
        body.studentNumber = studentLookup.studentNumber;
      }

      const res = await fetch("http://localhost:3001/orders/cashier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to place cashier order");
      }

      const result = data as CashierOrderResult;
      setOrderResult(result);

      if (result.paymentStatus === "PENDING") {
        // Start polling for M-Pesa confirmation
        setMpesaPollStatus("POLLING");
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          if (attempts > 30) {
            clearInterval(interval);
            setMpesaPollStatus("TIMEOUT");
            return;
          }

          try {
            const statusRes = await fetch(`http://localhost:3001/payments/status/${result.order.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const statusData = await statusRes.json();

            if (statusRes.ok) {
              if (statusData.status === "COMPLETED") {
                clearInterval(interval);
                setMpesaPollStatus("SUCCESS");
                setMpesaReferenceCode(statusData.referenceCode || "");
              } else if (statusData.status === "FAILED") {
                clearInterval(interval);
                setMpesaPollStatus("FAILED");
              }
            }
          } catch {
            // Ignore polling errors
          }
        }, 2000);
      }

      setCart([]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Order placement failed.";
      setOrderError(errMsg);
    } finally {
      setOrderLoading(false);
    }
  };

  const handleNewOrder = () => {
    setOrderResult(null);
    setStudentNumberInput("");
    setStudentLookup(null);
    setPaymentMethod("CASH");
    setMpesaPollStatus("IDLE");
    setMpesaReferenceCode("");
    setCopied(false);
  };

  const copyReference = (code: string) => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered dishes
  const filteredDishes = menu?.dishes.filter((dish) => {
    if (searchTerm.trim()) {
      return dish.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  }) || [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C59B27] border-t-transparent mx-auto mb-4"></div>
          <p className="text-zinc-400 text-sm">Loading cashier workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#140404] to-black text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Café<span className="text-[#C59B27]">Q</span>
              <span className="text-sm font-normal text-zinc-400 ml-3">Cashier Terminal</span>
            </h1>
            {user && (
              <p className="text-xs text-zinc-400 mt-0.5">
                Logged in as <span className="text-[#C59B27]">{user.fullName}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Two-Panel Layout */}
      <div className="max-w-[1600px] mx-auto flex gap-0 min-h-[calc(100vh-73px)]">
        {/* LEFT PANEL — Menu Catalog */}
        <div className="flex-1 border-r border-white/5 p-6 overflow-y-auto">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none focus:ring-1 focus:ring-[#C59B27] transition"
            />
          </div>

          {/* Dietary Filters */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {DIETARY_FILTERS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide transition border ${
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

          {/* Dish List */}
          {!menu ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 bg-white/5">
              <h2 className="text-lg font-semibold text-zinc-400">No active menu</h2>
              <p className="text-sm text-zinc-500 mt-2">Check back during serving hours.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredDishes.map((dish) => {
                const isSoldOut = dish.isSoldOut || dish.liveQuantity <= 0;
                const lowStock = dish.liveQuantity > 0 && dish.liveQuantity <= 20;
                const inCart = cart.find((c) => c.id === dish.id);

                return (
                  <div
                    key={dish.id}
                    onClick={() => !isSoldOut && addToCart(dish)}
                    className={`relative flex items-center justify-between rounded-xl border p-4 transition cursor-pointer ${
                      isSoldOut
                        ? "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                        : inCart
                        ? "border-[#C59B27]/40 bg-[#C59B27]/5 hover:bg-[#C59B27]/10"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white text-sm truncate">{dish.name}</h4>
                        {inCart && (
                          <span className="text-[10px] bg-[#C59B27] text-black px-1.5 py-0.5 rounded font-bold">
                            ×{inCart.quantity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#C59B27] font-bold">
                          KES {Number(dish.price).toLocaleString()}
                        </span>
                        {isSoldOut ? (
                          <span className="text-[10px] text-red-400 font-bold">SOLD OUT</span>
                        ) : lowStock ? (
                          <span className="text-[10px] text-amber-400 font-bold animate-pulse">
                            {dish.liveQuantity} left
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500">
                            {dish.liveQuantity} portions
                          </span>
                        )}
                      </div>
                    </div>
                    {!isSoldOut && (
                      <span className="text-zinc-500 text-lg ml-3">+</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Order Builder */}
        <div className="w-[440px] flex-shrink-0 flex flex-col p-6 bg-black/30">
          {/* Order Success State */}
          {orderResult ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* CASH success or M-Pesa confirmed */}
              {(orderResult.paymentStatus === "SUCCESS" || mpesaPollStatus === "SUCCESS") ? (
                <div className="w-full text-center">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                    ✓
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">Order Confirmed</h3>
                  <p className="text-xs text-zinc-400 mb-6">
                    {paymentMethod === "CASH" ? "Cash payment received." : "M-Pesa payment confirmed."}
                  </p>

                  {/* Reference Code */}
                  <div className="p-5 rounded-2xl border border-[#C59B27]/30 bg-gradient-to-r from-[#C59B27]/5 to-[#C59B27]/10 text-center shadow-inner mb-6">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-1">
                      Pickup Reference Code
                    </div>
                    <div className="text-4xl font-black tracking-widest text-[#C59B27] font-mono select-all">
                      {orderResult.referenceCode || mpesaReferenceCode}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white/5 border border-white/5 p-4 text-left mb-6 text-xs space-y-2">
                    <div className="flex justify-between text-zinc-400">
                      <span>Order ID:</span>
                      <span className="font-mono text-white">{orderResult.order.id.substring(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Total:</span>
                      <span className="text-[#C59B27] font-bold">KES {Number(orderResult.order.totalAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Payment:</span>
                      <span className="text-emerald-400 font-semibold">{paymentMethod}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => copyReference(orderResult.referenceCode || mpesaReferenceCode)}
                      className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs font-bold text-zinc-300 hover:bg-white/5 transition"
                    >
                      {copied ? "Copied!" : "Copy Ref"}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs font-bold text-zinc-300 hover:bg-white/5 transition"
                    >
                      Print
                    </button>
                    <button
                      onClick={handleNewOrder}
                      className="flex-1 rounded-lg bg-[#C59B27] py-2.5 text-xs font-bold text-black hover:brightness-110 transition"
                    >
                      New Order
                    </button>
                  </div>
                </div>
              ) : mpesaPollStatus === "POLLING" ? (
                <div className="text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C59B27] border-t-transparent mx-auto mb-4"></div>
                  <h3 className="text-lg font-bold text-white mb-2">Awaiting M-Pesa Payment</h3>
                  <p className="text-xs text-zinc-400">
                    STK Push sent to student&apos;s phone. Waiting for confirmation...
                  </p>
                </div>
              ) : mpesaPollStatus === "FAILED" || mpesaPollStatus === "TIMEOUT" ? (
                <div className="text-center">
                  <div className="h-14 w-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl">
                    ✕
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {mpesaPollStatus === "TIMEOUT" ? "Payment Timed Out" : "Payment Failed"}
                  </h3>
                  <p className="text-xs text-zinc-400 mb-6">The M-Pesa transaction was not completed.</p>
                  <button
                    onClick={handleNewOrder}
                    className="rounded-lg bg-[#C59B27] px-6 py-2.5 text-xs font-bold text-black hover:brightness-110 transition"
                  >
                    Start New Order
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-white tracking-wide mb-4 border-b border-white/5 pb-3">
                Order Builder
              </h3>

              {/* Student Lookup */}
              <div className="mb-5">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-2">
                  Student Number (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. STR001"
                    value={studentNumberInput}
                    onChange={(e) => setStudentNumberInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleStudentLookup()}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#C59B27] focus:outline-none focus:ring-1 focus:ring-[#C59B27] transition"
                  />
                  <button
                    onClick={() => void handleStudentLookup()}
                    disabled={studentLoading}
                    className="rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/20 transition disabled:opacity-50"
                  >
                    {studentLoading ? "..." : "Verify"}
                  </button>
                </div>
                {studentLookup && (
                  <div className={`mt-2 rounded-lg p-2.5 text-xs ${
                    studentLookup.found
                      ? "bg-emerald-950/30 border border-emerald-500/30 text-emerald-300"
                      : "bg-red-950/30 border border-red-500/30 text-red-300"
                  }`}>
                    {studentLookup.found
                      ? `✓ ${studentLookup.fullName} (${studentLookup.studentNumber})`
                      : "✕ Student not found. Proceeding as walk-in."}
                  </div>
                )}
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto mb-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-zinc-500 text-sm">Select dishes from the left panel to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <h4 className="font-semibold text-white text-sm">{item.name}</h4>
                          <p className="text-[11px] text-zinc-500">
                            KES {item.price.toLocaleString()} × {item.quantity} = KES {(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="h-7 w-7 rounded bg-white/5 border border-white/10 flex items-center justify-center text-xs hover:bg-white/10 transition"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="h-7 w-7 rounded bg-white/5 border border-white/10 flex items-center justify-center text-xs hover:bg-white/10 transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Method Toggle */}
              {cart.length > 0 && (
                <div className="border-t border-white/5 pt-4 space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-2">
                      Payment Method
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPaymentMethod("CASH")}
                        className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition border ${
                          paymentMethod === "CASH"
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        onClick={() => setPaymentMethod("MPESA")}
                        className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition border ${
                          paymentMethod === "MPESA"
                            ? "bg-[#4CAF50]/20 border-[#4CAF50]/40 text-[#4CAF50]"
                            : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                        }`}
                      >
                        📱 M-Pesa
                      </button>
                    </div>
                    {paymentMethod === "MPESA" && (!studentLookup || !studentLookup.found) && (
                      <p className="text-[10px] text-amber-400 mt-1.5">
                        ⚠ M-Pesa requires a verified student number
                      </p>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Total:</span>
                    <span className="text-xl font-bold text-[#C59B27]">
                      KES {cartTotal.toLocaleString()}
                    </span>
                  </div>

                  {orderError && (
                    <div className="rounded-lg bg-red-950/20 border border-red-500/30 p-2.5 text-xs text-red-200">
                      {orderError}
                    </div>
                  )}

                  {/* Place Order Button */}
                  <button
                    onClick={() => void handlePlaceOrder()}
                    disabled={orderLoading || (paymentMethod === "MPESA" && (!studentLookup || !studentLookup.found))}
                    className="w-full rounded-lg bg-gradient-to-r from-[#7A1C1C] to-[#C59B27] py-3 text-sm font-bold text-white shadow-lg hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {orderLoading ? "Processing..." : `Place Order & Pay (${paymentMethod})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
