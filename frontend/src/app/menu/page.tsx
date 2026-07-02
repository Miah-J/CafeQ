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
  const [pendingTopUpPaymentId, setPendingTopUpPaymentId] = useState<string | null>(null);

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
  const [transactionDrawerOpen, setTransactionDrawerOpen] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchWalletBalance = async () => {
    const token = sessionStorage.getItem("token");
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

  const fetchTransactionHistory = async () => {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    setHistoryLoading(true);
    try {
      const res = await fetch("http://localhost:3001/payments/history", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactionHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch transaction history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchLoyaltyStatus = async () => {
    const token = sessionStorage.getItem("token");
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
    const token = sessionStorage.getItem("token");
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
    const token = sessionStorage.getItem("token");
    const storedUser = sessionStorage.getItem("user");

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
        const res = await fetch(`http://localhost:3001/menus/active`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          router.push("/login");
          return;
        }

        const text = await res.text();
        if (res.ok) {
          if (!text || text === "null" || text === "undefined") {
            setMenu(null);
            setError("");
          } else {
            const data = JSON.parse(text);
            setMenu(data);
            setError("");
          }
        } else {
          let message = "Failed to load active menu";
          try {
            const data = JSON.parse(text);
            message = data.message || message;
          } catch {}
          setError(message);
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
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
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
    setPendingTopUpPaymentId(null);
  };

  const handleBypassOrderPayment = async () => {
    if (!pendingOrderId) return;
    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3001/payments/bypass-order/${pendingOrderId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          setPollIntervalId(null);
        }
        
        // Retrieve final status from status check
        const statusRes = await fetch(`http://localhost:3001/payments/status/${pendingOrderId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const statusData = await statusRes.json();

        if (statusRes.ok && statusData.status === "COMPLETED") {
          setMpesaReceipt(statusData.transactionReference || "MOCK-REF");
          setPaymentStatus("SUCCESS");
          setOrderSuccess({
            id: pendingOrderId,
            status: "CONFIRMED",
            totalAmount: cartTotal,
            referenceCode: statusData.referenceCode,
            items: [],
          });
          setCart([]);
          setPointsToRedeemInput("");
          void fetchWalletBalance();
          void fetchLoyaltyStatus();
        }
      } else {
        const data = await res.json();
        alert(data.message || "Failed to bypass order payment verification");
      }
    } catch (err) {
      console.error("Bypass checkout error:", err);
    }
  };

  const handleBypassTopUpPayment = async () => {
    if (!pendingTopUpPaymentId) return;
    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3001/payments/bypass-payment/${pendingTopUpPaymentId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        if (topUpPollIntervalId) {
          clearInterval(topUpPollIntervalId);
          setTopUpPollIntervalId(null);
        }

        // Retrieve receipt number from status check
        const statusRes = await fetch(`http://localhost:3001/payments/status/payment/${pendingTopUpPaymentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const statusData = await statusRes.json();

        if (statusRes.ok && statusData.status === "COMPLETED") {
          setTopUpReceipt(statusData.transactionReference || "MOCK-REF");
          setTopUpStatus("SUCCESS");
          void fetchWalletBalance();
        }
      } else {
        const data = await res.json();
        alert(data.message || "Failed to bypass top-up verification");
      }
    } catch (err) {
      console.error("Bypass top-up error:", err);
    }
  };

  const handleWalletTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = sessionStorage.getItem("token");
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
      setPendingTopUpPaymentId(paymentId);

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
    const token = sessionStorage.getItem("token");
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
    const token = sessionStorage.getItem("token");
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
    return menu?.dishes || [];
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

  const renderCartContent = () => {
    if (cart.length === 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "220px", gap: "12px", color: "rgba(114, 106, 99, 0.5)", textAlign: "center" }}>
          <div style={{ fontSize: "36px" }}>🛒</div>
          <p style={{ fontSize: "12px", fontWeight: "600", maxWidth: "200px", lineHeight: "1.5" }}>Your pre-order cart is empty. Add dishes to get started.</p>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "15px" }}>
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
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                <input 
                  type="checkbox"
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
        </div>

        <div style={{ borderTop: "1px solid rgba(114, 106, 99, 0.15)", paddingTop: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "700", marginBottom: "5px" }}>
            <span>Total Price Due:</span>
            <span style={{ color: "#b7786b" }}>KES {Math.max(0, cartTotal - pointsToRedeem).toFixed(2)}</span>
          </div>
          <button 
            disabled={checkoutLoading || !!redeemError} 
            onClick={handleCheckout} 
            className="clear-filters-btn" 
            style={{ backgroundColor: "var(--color-primary)", color: "#ffffff", border: "none", width: "100%" }}
          >
            {checkoutLoading ? "Locking portions..." : "Confirm & Checkout"}
          </button>
        </div>
      </div>
    );
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
              <button 
                onClick={() => {
                  void fetchTransactionHistory();
                  setTransactionDrawerOpen(true);
                }} 
                className="slide-btn" 
                style={{ padding: "6px 12px", fontSize: "9px", backgroundColor: "transparent", border: "1px solid rgba(114,106,99,0.3)", color: "#726a63", boxShadow: "none" }}
              >
                History
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

            <button
              onClick={handleLogout}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#726a63",
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
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

      {/* TODAY'S MENU HEADER SECTION */}
      <section style={{ 
        maxWidth: "1400px", 
        margin: "60px auto 30px", 
        padding: "0 40px", 
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px"
      }}>
        <h1 style={{ 
          fontFamily: "var(--font-heading)", 
          fontSize: "48px", 
          fontWeight: "400",
          color: "#3b3531", 
          margin: 0, 
          letterSpacing: "-0.01em" 
        }}>
          Today's Menu
        </h1>
        <p style={{ 
          fontSize: "15px", 
          color: "#726a63", 
          lineHeight: "1.6",
          maxWidth: "600px", 
          margin: "8px 0 0" 
        }}>
          Browse freshly prepared daily specials, view real-time portion availability, and secure your order for instant counter pickup.
        </p>
      </section>

      {!menu ? (
        <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
          <div style={{ textAlign: "center", padding: "80px 40px", backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "24px", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "15px" }}>
            <div style={{ fontSize: "48px" }}>🍽️</div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#3b3531", fontFamily: "var(--font-heading)" }}>No Active Menu Available</h2>
            <p style={{ fontSize: "13px", color: "rgba(114, 106, 99, 0.7)", lineHeight: "1.5" }}>Our culinary staff is currently preparing today's fresh selections. Please check back soon!</p>
          </div>
        </main>
      ) : (
        <>
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

            <div className="catalog-layout-container">
              <div className="catalog-left-column">
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
              </div>

              <div className="catalog-right-column">
                <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "20px", color: "#3b3531", fontWeight: 400, borderBottom: "1px solid rgba(114, 106, 99, 0.1)", paddingBottom: "10px", margin: 0 }}>Review Order</h3>
                  {renderCartContent()}
                </div>
              </div>
            </div>
          </main>
        </>
      )}

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
        <div className="drawer-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {renderCartContent()}
        </div>
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

      {/* TRANSACTION HISTORY DRAWER */}
      {transactionDrawerOpen && <div className="drawer-overlay open" onClick={() => setTransactionDrawerOpen(false)}></div>}
      <div className={`filter-drawer ${transactionDrawerOpen ? "open" : ""}`} id="transaction-drawer">
        <div className="drawer-header">
          <h2 className="drawer-title">Transaction History</h2>
          <button className="drawer-close" onClick={() => setTransactionDrawerOpen(false)} aria-label="Close transactions">
            <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" fill="none"/></svg>
          </button>
        </div>
        
        <div className="drawer-content">
          {historyLoading ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ border: "3px solid #b7786b", borderTopColor: "transparent", borderRadius: "50%", width: "30px", height: "30px", animation: "spin 1s linear infinite", margin: "0 auto 15px" }}></div>
              <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.7)", fontWeight: "600" }}>Loading transactions...</p>
            </div>
          ) : transactionHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(114, 106, 99, 0.7)", fontSize: "12px" }}>
              No transactions recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {transactionHistory.map((tx) => {
                const isTopUp = !tx.orderId;
                const statusColor = tx.status === "COMPLETED" ? "#10B981" : tx.status === "PENDING" ? "#C48000" : "#DC2626";
                const statusBg = tx.status === "COMPLETED" ? "rgba(16, 185, 129, 0.08)" : tx.status === "PENDING" ? "rgba(196, 128, 0, 0.08)" : "rgba(220, 38, 38, 0.08)";
                const statusBorder = tx.status === "COMPLETED" ? "rgba(16, 185, 129, 0.2)" : tx.status === "PENDING" ? "rgba(196, 128, 0, 0.2)" : "rgba(220, 38, 38, 0.2)";

                return (
                  <div 
                    key={tx.id} 
                    style={{ 
                      border: "1px solid rgba(114,106,99,0.12)", 
                      borderRadius: "15px", 
                      padding: "15px", 
                      backgroundColor: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "12px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <span 
                          style={{ 
                            fontSize: "9px", 
                            fontWeight: "750", 
                            textTransform: "uppercase", 
                            letterSpacing: "0.08em", 
                            backgroundColor: isTopUp ? "rgba(16, 185, 129, 0.08)" : "rgba(183, 120, 107, 0.08)",
                            border: isTopUp ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(183, 120, 107, 0.2)",
                            padding: "3px 8px", 
                            borderRadius: "10px", 
                            color: isTopUp ? "#10B981" : "#b7786b",
                            display: "inline-block",
                            marginBottom: "6px"
                          }}
                        >
                          {isTopUp ? "Wallet Top-Up" : "Meal Order"}
                        </span>
                        <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#726a63", margin: 0 }}>
                          {isTopUp ? "M-Pesa Top Up" : `Order Code: ${tx.orderCode || "N/A"}`}
                        </h4>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: "900", color: isTopUp ? "#10B981" : "#726a63" }}>
                        {isTopUp ? `+` : `-`} KES {tx.amount.toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "rgba(114,106,99,0.7)", borderTop: "1px solid rgba(114,106,99,0.06)", paddingTop: "8px", marginTop: "4px" }}>
                      <span>Ref: {tx.transactionReference || "N/A"}</span>
                      <span>{tx.method}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "rgba(114,106,99,0.5)" }}>
                      <span>{new Date(tx.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                      <span 
                        style={{ 
                          fontSize: "9px", 
                          fontWeight: "700", 
                          textTransform: "uppercase", 
                          letterSpacing: "0.08em", 
                          backgroundColor: statusBg,
                          border: statusBorder,
                          padding: "2px 8px", 
                          borderRadius: "10px", 
                          color: statusColor
                        }}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button className="clear-filters-btn" onClick={() => setTransactionDrawerOpen(false)}>Close Panel</button>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                  <button onClick={handleBypassOrderPayment} className="slide-btn" style={{ width: "100%", backgroundColor: "#636e52" }}>I Have Paid (Proceed)</button>
                  <button onClick={cancelPaymentVerification} className="slide-btn" style={{ width: "100%", backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}>Cancel & Edit Order</button>
                </div>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
                  <button onClick={handleBypassTopUpPayment} className="slide-btn" style={{ width: "100%", backgroundColor: "#636e52" }}>I Have Paid (Proceed)</button>
                  <button onClick={cancelTopUpVerification} className="slide-btn" style={{ width: "100%", backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}>Cancel Polling</button>
                </div>
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



      {/* FOOTER */}
      <footer className="footer" style={{ marginTop: "auto" }}>
        <div className="footer-grid">
          <div className="footer-brand">
            <h2 className="footer-title">Pre-order. Pay. Pick Up.</h2>
          </div>
          
          <div className="footer-column">
            <h3 className="footer-heading">Services</h3>
            <ul className="footer-links">
              <li><Link href={user ? getDashboardLink() : "/login"}>Daily Menu</Link></li>
              <li><Link href="/register">Student Signup</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div>&copy; {new Date().getFullYear()} CaféQ Strathmore Dining. All rights reserved.</div>
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
