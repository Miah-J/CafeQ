"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { io, Socket } from "socket.io-client";

interface OrderItem {
  orderItemId: string;
  dishId: string;
  dishName: string;
  quantity: number;
  unitPrice: number;
  status: "PENDING" | "COLLECTED" | "REFUNDED";
}

interface OrderDetail {
  orderId: string;
  referenceCode: string;
  status: string;
  studentName: string;
  studentNumber: string;
  createdAt: string;
  items: OrderItem[];
}

export default function ServingLookup() {
  const router = useRouter();
  const [referenceCode, setReferenceCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      if (user.role !== "ServingStaff" && user.role !== "Admin") {
        setError("Unauthorized access. Serving Staff role required.");
        setTimeout(() => router.push("/"), 3000);
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  // Socket.IO real-time updates for /server-lookup namespace
  useEffect(() => {
    socketRef.current = io("http://localhost:3001/server-lookup");

    socketRef.current.on("connect", () => {
      console.log("Connected to /server-lookup websocket namespace");
    });

    socketRef.current.on("order:item_collected", (data: { orderId: string; orderItemId: string; status: string }) => {
      setOrder((prevOrder) => {
        if (!prevOrder || prevOrder.orderId !== data.orderId) {
          return prevOrder;
        }

        const updatedItems = prevOrder.items.map((item) =>
          item.orderItemId === data.orderItemId
            ? { ...item, status: data.status as any }
            : item
        );

        return { ...prevOrder, items: updatedItems };
      });
    });

    socketRef.current.on("order:completed", (data: { orderId: string; status: string }) => {
      setOrder((prevOrder) => {
        if (!prevOrder || prevOrder.orderId !== data.orderId) {
          return prevOrder;
        }
        return { ...prevOrder, status: data.status };
      });
      setSuccessMsg("Order is fully dispensed!");
      setTimeout(() => setSuccessMsg(""), 4000);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleKeypadPress = (val: string) => {
    setError("");
    if (val === "BACK") {
      setReferenceCode((prev) => prev.slice(0, -1));
    } else if (val === "CLEAR") {
      setReferenceCode("");
    } else {
      if (referenceCode.length < 6) {
        setReferenceCode((prev) => (prev + val).toUpperCase());
      }
    }
  };

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (referenceCode.length !== 6) {
      setError("Please enter a valid 6-character reference code.");
      return;
    }

    setLoading(true);
    setError("");
    setOrder(null);

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:3001/collection/lookup/${referenceCode}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to locate reference code.");
      }

      setOrder(data);
    } catch (err: any) {
      setError(err.message || "Lookup failed. Please check the code.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCollected = async (orderItemId: string) => {
    const token = localStorage.getItem("token");
    setError("");

    try {
      const res = await fetch(`http://localhost:3001/collection/collect/${orderItemId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to mark item collected.");
      }

      // Update local state
      setOrder((prev) => {
        if (!prev) return null;
        const updatedItems = prev.items.map((item) =>
          item.orderItemId === orderItemId ? { ...item, status: "COLLECTED" as const } : item
        );
        const allDone = updatedItems.every((i) => i.status === "COLLECTED" || i.status === "REFUNDED");
        return {
          ...prev,
          status: allDone ? "COLLECTED" : prev.status,
          items: updatedItems,
        };
      });

      setSuccessMsg("Item verified and dispensed!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setError(err.message || "Collection update failed.");
    }
  };

  const handleReset = () => {
    setOrder(null);
    setReferenceCode("");
    setError("");
    setSuccessMsg("");
  };

  const keys = [
    ["A", "B", "C", "D", "E", "F"],
    ["G", "H", "I", "J", "K", "L"],
    ["M", "N", "O", "P", "Q", "R"],
    ["S", "T", "U", "V", "W", "X"],
    ["Y", "Z", "1", "2", "3", "4"],
    ["5", "6", "7", "8", "9", "0"],
  ];

  return (
    <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      
      {/* ANNOUNCEMENT BAR (MARQUEE) */}
      <div className="announcement-bar">
        <div className="announcement-bar__content">
          <span className="announcement-bar__item">Strathmore University Dining</span>
          <span className="announcement-bar__item">Serving & Dispensing Desk Monitor</span>
          <span className="announcement-bar__item">KenyaSMS Automated Dispatch confirmations</span>
          <span className="announcement-bar__item">Enter Student Pickup Reference Ticket</span>
          {/* Repeated for marquee loop */}
          <span className="announcement-bar__item">Strathmore University Dining</span>
          <span className="announcement-bar__item">Serving & Dispensing Desk Monitor</span>
          <span className="announcement-bar__item">KenyaSMS Automated Dispatch confirmations</span>
          <span className="announcement-bar__item">Enter Student Pickup Reference Ticket</span>
        </div>
      </div>

      {/* HEADER */}
      <header className="header-wrapper">
        <div className="header-top" style={{ padding: "15px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="logo">CAFÉQ</span>
            <span style={{ height: "16px", width: "1px", backgroundColor: "rgba(114, 106, 99, 0.2)", margin: "0 10px" }}></span>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.6)" }}>
              Dispensing Tablet
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", backgroundColor: "rgba(99, 110, 82, 0.1)", border: "1px solid rgba(99, 110, 82, 0.25)", color: "#636e52", padding: "5px 12px", borderRadius: "10px" }}>
              Station Active
            </span>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.push("/login");
              }}
              className="nav-link"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em" }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="main-content" style={{ flexGrow: 1, padding: "40px 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        
        {error && (
          <div style={{ maxWidth: "600px", margin: "0 auto 20px", width: "100%", backgroundColor: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "10px", color: "#DC2626", padding: "12px 20px", fontSize: "12px", fontWeight: "700", textAlign: "center" }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ maxWidth: "600px", margin: "0 auto 20px", width: "100%", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "10px", color: "#10B981", padding: "12px 20px", fontSize: "12px", fontWeight: "700", textAlign: "center" }}>
            {successMsg}
          </div>
        )}

        {!order ? (
          /* State 1: Enter Reference Code Input view with virtual keypad */
          <div style={{ maxWidth: "500px", width: "100%", margin: "0 auto", backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "35px", boxShadow: "0 10px 45px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", alignItems: "center", color: "#726a63", fontFamily: "Libre Franklin" }}>
            
            <h2 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.6)", marginBottom: "25px" }}>
              Enter Pickup Code
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (referenceCode.length === 6 && !loading) {
                  handleLookup();
                }
              }}
              style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              <input
                type="text"
                autoFocus
                maxLength={6}
                value={referenceCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                  setReferenceCode(val);
                }}
                placeholder="ENTER CODE"
                style={{ width: "100%", height: "65px", backgroundColor: "#faf9f7", borderRadius: "15px", border: "1px solid rgba(114, 106, 99, 0.3)", textAlign: "center", fontSize: "32px", fontFamily: "monospace", fontWeight: "900", letterSpacing: "0.25em", color: "#726a63", outline: "none", transition: "all 0.3s ease", marginBottom: "25px", boxShadow: "inset 0 2px 5px rgba(0,0,0,0.02)" }}
              />

              {/* Keypad Grid (6 columns for A-Z, 0-9) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px", width: "100%", marginBottom: "15px" }}>
                {keys.flat().map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    style={{ height: "42px", fontSize: "11px", fontWeight: "900", borderRadius: "10px", backgroundColor: "#faf9f7", border: "1px solid rgba(114, 106, 99, 0.15)", color: "#726a63", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseDown={(e) => { e.currentTarget.style.backgroundColor = "rgba(183, 120, 107, 0.15)"; }}
                    onMouseUp={(e) => { e.currentTarget.style.backgroundColor = "#faf9f7"; }}
                  >
                    {key}
                  </button>
                ))}
              </div>

              {/* Clear & Back controls */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", width: "100%", marginBottom: "25px" }}>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("CLEAR")}
                  style={{ height: "45px", fontSize: "11px", fontWeight: "700", borderRadius: "30px", backgroundColor: "rgba(114, 106, 99, 0.05)", border: "1px solid rgba(114, 106, 99, 0.2)", color: "#726a63", cursor: "pointer", transition: "all 0.2s" }}
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("BACK")}
                  style={{ height: "45px", fontSize: "11px", fontWeight: "700", borderRadius: "30px", backgroundColor: "rgba(114, 106, 99, 0.05)", border: "1px solid rgba(114, 106, 99, 0.2)", color: "#726a63", cursor: "pointer", transition: "all 0.2s" }}
                >
                  BACKSPACE
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || referenceCode.length !== 6}
                className="slide-btn"
                style={{ width: "100%", height: "50px", opacity: (referenceCode.length !== 6 || loading) ? 0.5 : 1 }}
              >
                {loading ? "SEARCHING..." : "LOOKUP TICKET"}
              </button>
            </form>
          </div>
        ) : (
          /* State 2: Result details and list items */
          <div style={{ maxWidth: "700px", width: "100%", margin: "0 auto", backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "35px", boxShadow: "0 10px 45px rgba(0,0,0,0.03)", color: "#726a63", fontFamily: "Libre Franklin" }}>
            
            {/* Header info */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(114, 106, 99, 0.15)", paddingBottom: "20px", marginBottom: "25px", gap: "15px" }}>
              <div>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.5)", display: "block", marginBottom: "5px" }}>
                  Pickup Reference
                </span>
                <span style={{ fontSize: "28px", fontWeight: "900", fontFamily: "monospace", letterSpacing: "0.15em", color: "#b7786b" }}>
                  {order.referenceCode}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.5)", display: "block", marginBottom: "5px" }}>
                  Student Customer
                </span>
                <span style={{ fontSize: "16px", fontWeight: "700", display: "block", color: "#726a63" }}>
                  {order.studentName}
                </span>
                <span style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.7)", fontFamily: "monospace" }}>
                  ID: {order.studentNumber}
                </span>
              </div>
            </div>

            {/* List of items */}
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "30px" }}>
              <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.5)", display: "block" }}>
                Dishes in Order
              </span>
              {order.items.map((item) => {
                const isCollected = item.status === "COLLECTED";
                const isRefunded = item.status === "REFUNDED";

                let rowBg = "#ffffff";
                let rowBorder = "1px solid rgba(114, 106, 99, 0.15)";
                let rowColor = "#726a63";

                if (isCollected) {
                  rowBg = "rgba(16, 185, 129, 0.03)";
                  rowBorder = "1px solid rgba(16, 185, 129, 0.25)";
                  rowColor = "#10B981";
                } else if (isRefunded) {
                  rowBg = "rgba(114, 106, 99, 0.03)";
                  rowBorder = "1px solid rgba(114, 106, 99, 0.1)";
                  rowColor = "rgba(114, 106, 99, 0.6)";
                }

                return (
                  <div
                    key={item.orderItemId}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px", borderRadius: "15px", border: rowBorder, backgroundColor: rowBg, color: rowColor, transition: "all 0.2s" }}
                  >
                    <div style={{ flexGrow: 1, paddingRight: "15px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "700", textDecoration: (isCollected || isRefunded) ? "line-through" : "none" }}>
                          {item.dishName}
                        </span>
                        <span style={{ fontSize: "10px", fontWeight: "700", border: `1px solid ${isCollected ? "rgba(16,185,129,0.3)" : "rgba(114, 106, 99, 0.25)"}`, padding: "2px 8px", borderRadius: "8px" }}>
                          x{item.quantity}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.6)" }}>
                        Unit Price: KES {item.unitPrice.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      {isCollected ? (
                        <span style={{ fontSize: "11px", fontWeight: "750", color: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "8px 15px", borderRadius: "30px" }}>
                          ✓ Dispensed
                        </span>
                      ) : isRefunded ? (
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "rgba(114, 106, 99, 0.6)", padding: "8px 15px" }}>
                          Refunded
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarkCollected(item.orderItemId)}
                          className="slide-btn"
                          style={{ padding: "8px 18px", fontSize: "11px", height: "auto" }}
                        >
                          Mark Dispensed
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(114, 106, 99, 0.15)", paddingTop: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: "600" }}>
                <span>Order Status:</span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "4px 10px",
                    borderRadius: "10px",
                    backgroundColor: order.status === "COLLECTED" ? "rgba(16,185,129,0.1)" : order.status === "REFUNDED" ? "rgba(114,106,99,0.1)" : "rgba(183,120,107,0.1)",
                    color: order.status === "COLLECTED" ? "#10B981" : order.status === "REFUNDED" ? "#726a63" : "#b7786b"
                  }}
                >
                  {order.status}
                </span>
              </div>
              <button
                onClick={handleReset}
                className="slide-btn"
                style={{ height: "auto", padding: "10px 22px", backgroundColor: "transparent", border: "1px solid rgba(114,106,99,0.3)", color: "#726a63", boxShadow: "none" }}
              >
                ← Dispense New Ticket
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(114,106,99,0.1)", flexWrap: "wrap", gap: "10px" }}>
          <p style={{ fontSize: "10px", color: "rgba(114,106,99,0.6)" }}>© {new Date().getFullYear()} CaféQ Strathmore Dining. All rights reserved.</p>
          <span style={{ fontSize: "9px", fontFamily: "monospace", backgroundColor: "rgba(114,106,99,0.06)", border: "1px solid rgba(114,106,99,0.1)", padding: "4px 10px", borderRadius: "5px", color: "rgba(114,106,99,0.8)" }}>
            Dispenser Namespace /server-lookup Sync Enabled
          </span>
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
