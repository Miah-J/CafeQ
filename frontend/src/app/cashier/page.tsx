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

const DIETARY_FILTERS = ["All", "Halal", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"];

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
        const activeFilters = selectedTags.filter(t => t !== "All");
        const queryParams = activeFilters.length > 0
          ? `?tags=${activeFilters.join(",")}`
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
      <div className="flex min-h-screen items-center justify-center bg-background text-ink font-sans">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-secondary text-xs font-bold">Loading cashier workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-ink font-sans flex flex-col justify-between select-none">
      {/* Header */}
      <header className="bg-primary px-6 py-4 sticky top-0 z-40 text-white shadow-sm flex items-center justify-between">
        <div className="max-w-[1600px] w-full mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight hover:opacity-90 transition">
            CaféQ <span className="text-sm font-normal text-white/80 ml-3">Cashier Terminal</span>
          </h1>
          {user && (
            <span className="text-xs font-bold uppercase tracking-wider bg-white/10 px-3 py-1 rounded">
              Active Terminal
            </span>
          )}
        </div>
      </header>

      {/* Sub Bar */}
      <section className="bg-white border-b border-secondary/20 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {user && (
            <p className="text-xs text-secondary font-semibold">
              Logged in as: <span className="text-primary font-bold">{user.fullName}</span> ({user.role})
            </p>
          )}
          <button
            onClick={handleLogout}
            className="rounded border border-secondary/30 px-3 py-1 text-xs font-bold text-secondary hover:bg-secondary/5 transition"
          >
            Sign Out
          </button>
        </div>
      </section>

      {/* Main Two-Panel Layout */}
      <main className="max-w-[1600px] w-full mx-auto px-6 py-8 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT PANEL — Menu Catalog */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Search and Filters */}
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-[10px] border border-secondary/30 bg-white px-4 py-2.5 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none transition"
              />

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

            {/* Dish List Grid */}
            {!menu ? (
              <div className="text-center py-20 rounded-[10px] border border-dashed border-secondary/20 bg-white">
                <h2 className="text-lg font-semibold text-secondary">No active menu</h2>
                <p className="text-sm text-secondary/70 mt-2">Check back during serving hours.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredDishes.map((dish) => {
                  const isSoldOut = dish.isSoldOut || dish.liveQuantity <= 0;
                  const isLowStock = dish.liveQuantity > 0 && dish.liveQuantity <= 20;
                  const inCart = cart.find((c) => c.id === dish.id);

                  return (
                    <div
                      key={dish.id}
                      onClick={() => !isSoldOut && addToCart(dish)}
                      className={`relative flex flex-col justify-between rounded-[10px] border p-6 bg-white transition duration-150 cursor-pointer ${
                        isSoldOut
                          ? "border-secondary/20 opacity-60 bg-secondary/5 cursor-not-allowed"
                          : inCart
                          ? "border-primary bg-primary/5 hover:bg-primary/10"
                          : "border-secondary/20 hover:border-accent hover:shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
                      }`}
                    >
                      <div>
                        <div className="flex gap-4 items-start mb-4">
                          <div className="w-16 h-16 rounded-[8px] overflow-hidden shrink-0 border border-secondary/15 bg-gradient-to-br from-primary/10 to-accent/20 flex items-center justify-center">
                            {dish.imageUrl ? (
                              <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xl">🍲</span>
                            )}
                          </div>
                          
                          <div className="flex-grow min-w-0">
                            {/* Name & Price */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h4 className={`font-bold tracking-wide text-sm ${isSoldOut ? "text-secondary" : "text-ink"}`}>
                                  {dish.name}
                                </h4>
                                {inCart && (
                                  <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">
                                    ×{inCart.quantity}
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-ink text-sm shrink-0">
                                KES {Number(dish.price).toLocaleString()}
                              </span>
                            </div>

                            {/* Description */}
                            {dish.description && (
                              <p className="text-xs text-secondary leading-relaxed mt-1 line-clamp-2">
                                {dish.description}
                              </p>
                            )}
                          </div>
                        </div>

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

                      {/* Footer / Portions remaining */}
                      <div className="mt-4 border-t border-secondary/10 pt-4 flex items-center justify-between text-xs text-secondary font-medium">
                        <span>Portions remaining:</span>
                        {isSoldOut ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-status-sold-out/10 border border-status-sold-out/40 text-status-sold-out">
                            SOLD OUT
                          </span>
                        ) : isLowStock ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-semibold text-ink">
                              {dish.liveQuantity} portions
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-status-low-stock/15 border border-status-low-stock/40 text-status-low-stock animate-pulse">
                              LOW STOCK
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold text-ink">
                            {dish.liveQuantity} portions
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Order Builder */}
          <aside className="bg-white border border-secondary/20 rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            {orderResult ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                
                {/* SUCCESS STATE */}
                {(orderResult.paymentStatus === "SUCCESS" || mpesaPollStatus === "SUCCESS") ? (
                  <div className="w-full text-center">
                    <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                      ✓
                    </div>
                    <h3 className="text-xl font-bold text-ink mb-2">Order Confirmed</h3>
                    <p className="text-xs text-secondary mb-6 leading-relaxed">
                      {paymentMethod === "CASH" ? "Cash payment received." : "M-Pesa payment confirmed."}
                    </p>

                    {/* Reference Code */}
                    <div className="p-5 rounded-[10px] border border-accent bg-accent/10 text-center shadow-inner mb-6">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-secondary mb-1">
                        Pickup Reference Code
                      </div>
                      <div className="text-4xl font-black tracking-widest text-primary font-mono select-all">
                        {orderResult.referenceCode || mpesaReferenceCode}
                      </div>
                    </div>

                    <div className="rounded-[10px] border border-secondary/25 p-4 text-left mb-6 text-xs space-y-2 text-secondary">
                      <div className="flex justify-between">
                        <span>Order ID:</span>
                        <span className="font-mono text-ink font-bold">{orderResult.order.id.substring(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className="text-primary font-bold">KES {Number(orderResult.order.totalAmount).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment:</span>
                        <span className="text-emerald-600 font-semibold">{paymentMethod}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyReference(orderResult.referenceCode || mpesaReferenceCode)}
                          className="flex-1 rounded-[10px] border border-secondary/30 py-2.5 text-xs font-bold text-secondary hover:bg-secondary/5 transition cursor-pointer"
                        >
                          {copied ? "Copied!" : "Copy Ref"}
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="flex-1 rounded-[10px] border border-secondary/30 py-2.5 text-xs font-bold text-secondary hover:bg-secondary/5 transition cursor-pointer"
                        >
                          Print
                        </button>
                      </div>
                      <button
                        onClick={handleNewOrder}
                        className="w-full rounded-[10px] bg-primary py-2.5 text-xs font-bold text-white hover:bg-accent hover:text-ink transition cursor-pointer"
                      >
                        New Order
                      </button>
                    </div>
                  </div>
                ) : mpesaPollStatus === "POLLING" ? (
                  <div className="text-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                    <h3 className="text-lg font-bold text-ink mb-2">Awaiting M-Pesa Payment</h3>
                    <p className="text-xs text-secondary leading-relaxed">
                      STK Push sent to student&apos;s phone. Waiting for confirmation...
                    </p>
                  </div>
                ) : mpesaPollStatus === "FAILED" || mpesaPollStatus === "TIMEOUT" ? (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 rounded-full bg-red-100 border border-red-300 text-status-sold-out flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                      ✕
                    </div>
                    <h3 className="text-lg font-bold text-ink mb-2">
                      {mpesaPollStatus === "TIMEOUT" ? "Payment Timed Out" : "Payment Failed"}
                    </h3>
                    <p className="text-xs text-secondary mb-6 leading-relaxed">The M-Pesa transaction was not completed.</p>
                    <button
                      onClick={handleNewOrder}
                      className="rounded-[10px] bg-primary px-6 py-2.5 text-xs font-bold text-white hover:bg-accent hover:text-ink transition cursor-pointer"
                    >
                      Start New Order
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-ink mb-4 pb-3 border-b border-secondary/15 tracking-wide">
                  Order Builder
                </h3>

                {/* Student Lookup */}
                <div className="mb-5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                    Student Number (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. STR001"
                      value={studentNumberInput}
                      onChange={(e) => setStudentNumberInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void handleStudentLookup()}
                      className="flex-1 rounded-[10px] border border-secondary/30 bg-transparent px-3 py-2 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none transition"
                    />
                    <button
                      onClick={() => void handleStudentLookup()}
                      disabled={studentLoading}
                      className="rounded-[10px] bg-white border border-secondary/30 px-4 py-2 text-xs font-bold text-secondary hover:bg-secondary/5 transition disabled:opacity-50 cursor-pointer"
                    >
                      {studentLoading ? "..." : "Verify"}
                    </button>
                  </div>
                  {studentLookup && (
                    <div className={`mt-2 rounded-[10px] p-2.5 text-xs font-semibold ${
                      studentLookup.found
                        ? "bg-emerald-50 border border-emerald-300 text-emerald-700"
                        : "bg-red-50 border border-status-sold-out/30 text-status-sold-out"
                    }`}>
                      {studentLookup.found
                        ? `✓ ${studentLookup.fullName} (${studentLookup.studentNumber})`
                        : "✕ Student not found. Proceeding as walk-in."}
                    </div>
                  )}
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto mb-4 min-h-[150px]">
                  {cart.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-secondary text-xs font-medium">Select dishes from the left panel to begin.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between border-b border-secondary/10 pb-3">
                          <div>
                            <h4 className="font-bold text-ink text-xs mb-1">{item.name}</h4>
                            <p className="text-[10px] text-secondary font-medium">
                              KES {item.price.toLocaleString()} × {item.quantity} = KES {(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartQuantity(item.id, -1)}
                              className="h-6 w-6 rounded border border-secondary/35 flex items-center justify-center text-xs font-bold text-secondary hover:bg-secondary/5 transition cursor-pointer font-bold"
                            >
                              −
                            </button>
                            <span className="text-xs font-bold text-ink min-w-4 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, 1)}
                              className="h-6 w-6 rounded border border-secondary/35 flex items-center justify-center text-xs font-bold text-secondary hover:bg-secondary/5 transition cursor-pointer font-bold"
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
                  <div className="border-t border-secondary/15 pt-4 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                        Payment Method
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPaymentMethod("CASH")}
                          className={`flex-1 rounded-[10px] py-2.5 text-xs font-bold transition border cursor-pointer ${
                            paymentMethod === "CASH"
                              ? "bg-emerald-50 border-emerald-500/40 text-emerald-700"
                              : "bg-white border-secondary/35 text-secondary hover:bg-secondary/5"
                          }`}
                        >
                          💵 Cash
                        </button>
                        <button
                          onClick={() => setPaymentMethod("MPESA")}
                          className={`flex-1 rounded-[10px] py-2.5 text-xs font-bold transition border cursor-pointer ${
                            paymentMethod === "MPESA"
                              ? "bg-amber-50 border-status-low-stock/40 text-status-low-stock"
                              : "bg-white border-secondary/35 text-secondary hover:bg-secondary/5"
                          }`}
                        >
                          📱 M-Pesa
                        </button>
                      </div>
                      {paymentMethod === "MPESA" && (!studentLookup || !studentLookup.found) && (
                        <p className="text-[10px] text-status-low-stock font-bold mt-1.5 animate-pulse">
                          ⚠ M-Pesa requires a verified student number
                        </p>
                      )}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between border-t border-secondary/10 pt-3">
                      <span className="text-xs font-bold text-secondary">Grand Total Amount:</span>
                      <span className="text-lg font-black text-primary font-mono">
                        KES {cartTotal.toLocaleString()}
                      </span>
                    </div>

                    {orderError && (
                      <div className="rounded-[10px] bg-status-sold-out/10 border border-status-sold-out/30 p-2.5 text-xs font-bold text-status-sold-out">
                        {orderError}
                      </div>
                    )}

                    {/* Place Order Button */}
                    <button
                      onClick={() => void handlePlaceOrder()}
                      disabled={orderLoading || (paymentMethod === "MPESA" && (!studentLookup || !studentLookup.found))}
                      className="w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white shadow-sm hover:bg-accent hover:text-ink transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
                    >
                      {orderLoading ? "Processing..." : `Place Order & Pay (${paymentMethod})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-secondary/15 py-6 text-center text-[10px] text-secondary font-semibold bg-white px-6">
        <p>© {new Date().getFullYear()} CaféQ. Strathmore University Cafeteria. Kenya Data Protection Act 2019 Compliant.</p>
      </footer>
    </div>
  );
}
