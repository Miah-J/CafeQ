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
        } else {
          setError(data.message || "Failed to load active menu");
        }
      } catch {
        setError("Unable to connect to service. Checking connection...");
      } finally {
        setMenu(null); // Clear previous if loading fails, but polling will retry
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
      setOrderSuccess(data);
      setCart([]);
      setIsReviewOpen(false);
      setIsCartOpen(false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Checkout failed. Portions may have changed.";
      setError(errMsg);
      setIsReviewOpen(false);
    } finally {
      setCheckoutLoading(false);
    }
  };

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
              Your order has been logged and portions reserved. Proceed to M-Pesa push payment.
            </p>
            <div className="rounded-lg bg-white/5 border border-white/5 p-4 text-left space-y-3 mb-6 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2 text-xs text-zinc-400">
                <span>Order ID:</span>
                <span className="font-mono text-white">{orderSuccess.id}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2 text-xs text-zinc-400">
                <span>Status:</span>
                <span className="text-[#C59B27] font-semibold">{orderSuccess.status}</span>
              </div>
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
    </div>
  );
}
