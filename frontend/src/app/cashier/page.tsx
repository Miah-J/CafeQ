"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  UtensilsCrossed, 
  AlertTriangle, 
  Info, 
  Banknote, 
  Smartphone 
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
    const token = sessionStorage.getItem("token");
    const storedUser = sessionStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser) as User;
    if (parsedUser.role !== "Cashier") {
      router.push("/menu");
      return;
    }
    
    setUser(parsedUser);
    
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
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          router.push("/login");
          return;
        }

        const text = await res.text();
        if (res.ok) {
          if (!text || text === "null" || text === "undefined") {
            setMenu(null);
          } else {
            setMenu(JSON.parse(text));
          }
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

  // Student lookup
  const handleStudentLookup = useCallback(async () => {
    if (!studentNumberInput.trim()) {
      setStudentLookup(null);
      return;
    }

    const token = sessionStorage.getItem("token");
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
    const token = sessionStorage.getItem("token");
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
      <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ border: "4px solid #b7786b", borderTopColor: "transparent", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite", margin: "0 auto 15px" }}></div>
          <p style={{ fontFamily: "Libre Franklin", fontSize: "13px", fontWeight: 700, color: "#726a63" }}>Assembling cashier terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      

      {/* HEADER */}
      <header className="header-wrapper">
        <div className="header-top" style={{ padding: "15px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="logo">CAFÉQ</span>
            <span style={{ height: "16px", width: "1px", backgroundColor: "rgba(114, 106, 99, 0.2)", margin: "0 10px" }}></span>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.6)" }}>
              Cashier Terminal
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
            {user && (
              <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "rgba(114,106,99,0.7)" }}>
                Logged in as: <span style={{ color: "#b7786b" }}>{user.fullName}</span> ({user.role})
              </span>
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
          </div>
        </div>
      </header>

      <main className="main-content" style={{ flexGrow: 1, padding: "40px", maxWidth: "1600px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: "30px", alignItems: "start" }}>
          
          {/* LEFT PANEL — Menu Catalog */}
          <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            
            {/* Search and Filters */}
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "12px 20px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "13px", outline: "none", backgroundColor: "#ffffff", color: "#726a63" }}
              />

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {DIETARY_FILTERS.map((tag) => {
                  const active = tag === "All" ? selectedTags.length === 0 : selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: "8px 18px",
                        fontSize: "11px",
                        fontWeight: "700",
                        borderRadius: "20px",
                        border: "1px solid rgba(114, 106, 99, 0.25)",
                        backgroundColor: active ? "#b7786b" : "#ffffff",
                        color: active ? "#ffffff" : "#726a63",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dish List Grid */}
            {!menu ? (
              <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px" }}>
                <h2 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63" }}>No active menu published</h2>
                <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Check back during lunch session.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                {filteredDishes.map((dish) => {
                  const isSoldOut = dish.isSoldOut || dish.liveQuantity <= 0;
                  const isLowStock = dish.liveQuantity > 0 && dish.liveQuantity <= 20;
                  const inCart = cart.find((c) => c.id === dish.id);

                  return (
                    <div
                      key={dish.id}
                      onClick={() => !isSoldOut && addToCart(dish)}
                      style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: "15px",
                        border: inCart ? "2px solid #b7786b" : "1px solid rgba(114, 106, 99, 0.12)",
                        backgroundColor: inCart ? "rgba(183, 120, 107, 0.05)" : "#ffffff",
                        padding: "15px",
                        cursor: isSoldOut ? "not-allowed" : "pointer",
                        opacity: isSoldOut ? 0.65 : 1,
                        transition: "all 0.15s ease",
                        userSelect: "none"
                      }}
                    >
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <div style={{ width: "42px", height: "42px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(114, 106, 99, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(114,106,99,0.02)" }}>
                          {dish.imageUrl ? (
                            <img src={dish.imageUrl} alt={dish.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <UtensilsCrossed size={16} style={{ color: "rgba(114, 106, 99, 0.4)" }} />
                          )}
                        </div>
                        
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: "12px", fontWeight: "700", color: "#726a63", lineHeight: "1.2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {dish.name}
                          </h4>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "#b7786b" }}>KES {Number(dish.price).toFixed(2)}</span>
                            {inCart && (
                              <span style={{ fontSize: "10px", backgroundColor: "#b7786b", color: "#ffffff", padding: "1px 6px", borderRadius: "6px", fontWeight: "700" }}>
                                Qty: {inCart.quantity}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid rgba(114, 106, 99, 0.08)", marginTop: "10px", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px" }}>
                        {isSoldOut ? (
                          <span style={{ fontSize: "8px", fontWeight: "700", backgroundColor: "#DC2626", color: "#ffffff", padding: "2px 6px", borderRadius: "4px" }}>SOLD OUT</span>
                        ) : isLowStock ? (
                          <span style={{ color: "#C48000", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertTriangle size={12} /> {dish.liveQuantity} left
                          </span>
                        ) : (
                          <span style={{ color: "rgba(114, 106, 99, 0.6)", fontWeight: "600" }}>{dish.liveQuantity} available</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Order Builder */}
          <aside style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px", boxShadow: "0 10px 45px rgba(0,0,0,0.03)", color: "#726a63", fontFamily: "Libre Franklin", position: "sticky", top: "130px", maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
            {orderResult ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                
                {/* SUCCESS STATE */}
                {(orderResult.paymentStatus === "SUCCESS" || mpesaPollStatus === "SUCCESS") ? (
                  <div style={{ width: "100%", textAlign: "center" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "20px", fontWeight: "700" }}>
                      ✓
                    </div>
                    <h3 style={{ fontFamily: "DM Serif Display", fontSize: "20px", color: "#726a63", fontWeight: 400, marginBottom: "8px" }}>Order Confirmed</h3>
                    <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.8)", marginBottom: "25px" }}>
                      {paymentMethod === "CASH" ? "Cash payment received successfully." : "M-Pesa split payment verified."}
                    </p>

                    {/* Reference Code */}
                    <div style={{ border: "1px solid #b7786b", backgroundColor: "rgba(183, 120, 107, 0.08)", padding: "20px", borderRadius: "15px", marginBottom: "25px" }}>
                      <div style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.7)" }}>
                        Pickup Reference Code
                      </div>
                      <div style={{ fontSize: "36px", fontWeight: "900", fontFamily: "monospace", letterSpacing: "0.15em", color: "#b7786b", margin: "8px 0" }}>
                        {orderResult.referenceCode || mpesaReferenceCode}
                      </div>
                    </div>

                    <div style={{ border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "15px", padding: "15px", textAlign: "left", fontSize: "11px", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "25px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Order ID:</span>
                        <span style={{ fontFamily: "monospace", fontWeight: "700" }}>{orderResult.order.id.substring(0, 8)}...</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(114,106,99,0.08)", paddingTop: "8px", marginTop: "8px" }}>
                        <span>Total Paid:</span>
                        <span style={{ color: "#b7786b", fontWeight: "700" }}>KES {Number(orderResult.order.totalAmount).toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(114,106,99,0.08)", paddingTop: "8px", marginTop: "8px" }}>
                        <span>Method:</span>
                        <span style={{ color: "#10B981", fontWeight: "700" }}>{paymentMethod}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => copyReference(orderResult.referenceCode || mpesaReferenceCode)}
                          className="slide-btn"
                          style={{ flex: 1, backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}
                        >
                          {copied ? "Copied!" : "Copy Code"}
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="slide-btn"
                          style={{ flex: 1, backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}
                        >
                          Print Ticket
                        </button>
                      </div>
                      <button
                        onClick={handleNewOrder}
                        className="slide-btn"
                        style={{ width: "100%" }}
                      >
                        New Order
                      </button>
                    </div>
                  </div>
                ) : mpesaPollStatus === "POLLING" ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ border: "4px solid #b7786b", borderTopColor: "transparent", borderRadius: "50%", width: "36px", height: "36px", animation: "spin 1s linear infinite", margin: "0 auto 15px" }}></div>
                    <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63" }}>Awaiting M-Pesa Payment</h3>
                    <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.7)", marginTop: "10px" }}>
                      STK Push triggered on student phone. Polling for Safaricom confirmation callback...
                    </p>
                  </div>
                ) : (mpesaPollStatus === "FAILED" || mpesaPollStatus === "TIMEOUT") ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px", fontSize: "20px", fontWeight: "700" }}>✕</div>
                    <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63" }}>
                      {mpesaPollStatus === "TIMEOUT" ? "M-Pesa Payment Timeout" : "M-Pesa Payment Failed"}
                    </h3>
                    <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.7)", margin: "10px 0 25px" }}>Safaricom transaction failed or rejected.</p>
                    <button
                      onClick={handleNewOrder}
                      className="slide-btn"
                      style={{ width: "100%" }}
                    >
                      New Order
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.8)", paddingBottom: "8px", borderBottom: "1px solid rgba(114, 106, 99, 0.15)" }}>
                  Order Builder
                </h3>

                {/* Student Lookup */}
                <div>
                  <label htmlFor="studentNumberInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                    Student ID Number (optional)
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      id="studentNumberInput"
                      type="text"
                      placeholder="e.g. STR001"
                      value={studentNumberInput}
                      onChange={(e) => setStudentNumberInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void handleStudentLookup()}
                      style={{ flex: 1, padding: "8px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                    />
                    <button
                      onClick={() => void handleStudentLookup()}
                      disabled={studentLoading}
                      className="slide-btn"
                      style={{ height: "auto", padding: "8px 18px", fontSize: "11px", backgroundColor: "transparent", color: "#726a63", border: "1px solid rgba(114,106,99,0.3)", boxShadow: "none" }}
                    >
                      {studentLoading ? "..." : "Verify"}
                    </button>
                  </div>
                  {studentLookup && (
                    <div style={{
                      marginTop: "10px",
                      borderRadius: "10px",
                      padding: "10px 15px",
                      fontSize: "11px",
                      fontWeight: "700",
                      backgroundColor: studentLookup.found ? "rgba(16, 185, 129, 0.05)" : "rgba(220, 38, 38, 0.05)",
                      border: studentLookup.found ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(220, 38, 38, 0.2)",
                      color: studentLookup.found ? "#10B981" : "#DC2626"
                    }}>
                      {studentLookup.found
                        ? `${studentLookup.fullName} (${studentLookup.studentNumber})`
                        : "✕ Student not found in system. Walk-in cashier order."}
                    </div>
                  )}
                </div>

                {/* Cart Items */}
                <div style={{ flexGrow: 1, overflowY: "auto", minHeight: "150px" }}>
                  {cart.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "45px 10px", color: "rgba(114, 106, 99, 0.6)", fontSize: "12px" }}>
                      Cart is empty. Select dishes to build cashier order.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                      {cart.map((item) => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(114, 106, 99, 0.1)", paddingBottom: "10px" }}>
                          <div>
                            <h4 style={{ fontSize: "12px", fontWeight: "700" }}>{item.name}</h4>
                            <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.6)" }}>
                              KES {item.price.toFixed(2)} × {item.quantity} = KES {(item.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button 
                              onClick={() => updateCartQuantity(item.id, -1)}
                              style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px solid rgba(114,106,99,0.3)", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >−</button>
                            <span style={{ fontSize: "12px", fontWeight: "700", minWidth: "15px", textAlign: "center" }}>{item.quantity}</span>
                            <button 
                              onClick={() => updateCartQuantity(item.id, 1)}
                              style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px solid rgba(114,106,99,0.3)", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Method Toggle */}
                {cart.length > 0 && (
                  <div style={{ borderTop: "1px solid rgba(114, 106, 99, 0.15)", paddingTop: "15px", display: "flex", flexDirection: "column", gap: "15px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                        Payment Method
                      </label>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => setPaymentMethod("CASH")}
                          style={{
                            flex: 1,
                            padding: "10px 0",
                            fontSize: "12px",
                            fontWeight: "700",
                            borderRadius: "30px",
                            border: paymentMethod === "CASH" ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid rgba(114, 106, 99, 0.3)",
                            backgroundColor: paymentMethod === "CASH" ? "rgba(16, 185, 129, 0.05)" : "#ffffff",
                            color: paymentMethod === "CASH" ? "#10B981" : "#726a63",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px"
                          }}
                        >
                          <Banknote size={14} /> Cash Payment
                        </button>
                        <button
                          onClick={() => setPaymentMethod("MPESA")}
                          style={{
                            flex: 1,
                            padding: "10px 0",
                            fontSize: "12px",
                            fontWeight: "700",
                            borderRadius: "30px",
                            border: paymentMethod === "MPESA" ? "1px solid rgba(183, 120, 107, 0.5)" : "1px solid rgba(114, 106, 99, 0.3)",
                            backgroundColor: paymentMethod === "MPESA" ? "rgba(183, 120, 107, 0.05)" : "#ffffff",
                            color: paymentMethod === "MPESA" ? "#b7786b" : "#726a63",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px"
                          }}
                        >
                          <Smartphone size={14} /> M-Pesa STK Split
                        </button>
                      </div>
                      {paymentMethod === "MPESA" && (!studentLookup || !studentLookup.found) && (
                        <p style={{ fontSize: "10px", color: "#b7786b", fontWeight: "700", marginTop: "6px", animation: "pulse 1.5s infinite", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Info size={12} /> Verification of Student ID required for split M-Pesa topup trigger
                        </p>
                      )}
                    </div>

                    {/* Total */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(114, 106, 99, 0.1)", paddingTop: "12px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "rgba(114,106,99,0.7)" }}>Grand Total Due:</span>
                      <span style={{ fontSize: "18px", fontWeight: "900", fontFamily: "monospace", color: "#b7786b" }}>
                        KES {cartTotal.toFixed(2)}
                      </span>
                    </div>

                    {orderError && (
                      <div style={{ borderRadius: "10px", backgroundColor: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.2)", padding: "10px", fontSize: "11px", fontWeight: "700", color: "#DC2626" }}>
                        {orderError}
                      </div>
                    )}

                    {/* Place Order Button */}
                    <button
                      onClick={() => void handlePlaceOrder()}
                      disabled={orderLoading || (paymentMethod === "MPESA" && (!studentLookup || !studentLookup.found))}
                      className="slide-btn"
                      style={{ width: "100%", opacity: (orderLoading || (paymentMethod === "MPESA" && (!studentLookup || !studentLookup.found))) ? 0.5 : 1 }}
                    >
                      {orderLoading ? "Processing..." : `Checkout Order (${paymentMethod})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </aside>
          
        </div>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p style={{ fontSize: "10px", color: "rgba(114,106,99,0.6)", textAlign: "center" }}>
          © {new Date().getFullYear()} CaféQ. Strathmore University Cafeteria. Kenya Data Protection Act 2019 Compliant.
        </p>
      </footer>
    </div>
  );
}
