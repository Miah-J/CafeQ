"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Inbox } from "lucide-react";

interface KitchenDish {
  dishId: string;
  name: string;
  description: string | null;
  preparedQuantity: number;
  confirmedOrderCount: number;
  isSoldOut: boolean;
}

interface TicketItem {
  itemId: string;
  dishId: string;
  dishName: string;
  quantity: number;
  status: string;
}

interface Ticket {
  orderId: string;
  referenceCode: string;
  createdAt: string;
  status: string;
  items: TicketItem[];
}

export default function KitchenDisplay() {
  const router = useRouter();
  const [dishes, setDishes] = useState<KitchenDish[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const serverSocketRef = useRef<Socket | null>(null);

  // Authenticate user check (Admin, KitchenStaff, or ServingStaff)
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const storedUser = sessionStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      if (
        user.role !== "KitchenStaff" &&
        user.role !== "Admin" &&
        user.role !== "ServingStaff"
      ) {
        setError("Unauthorized access. Kitchen monitor role required.");
        setTimeout(() => router.push("/"), 3000);
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    router.push("/login");
  };

  // Fetch initial dishes and tickets
  const loadInitialData = async () => {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
      const [dishesRes, ticketsRes] = await Promise.all([
        fetch("http://localhost:3001/kitchen/dishes", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("http://localhost:3001/kitchen/tickets", {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      const dishesData = await dishesRes.json();
      const ticketsData = await ticketsRes.json();

      if (!dishesRes.ok) throw new Error(dishesData.message || "Failed to load dishes");
      if (!ticketsRes.ok) throw new Error(ticketsData.message || "Failed to load tickets");

      setDishes(dishesData);
      setTickets(ticketsData);
      setError("");
    } catch (err: any) {
      setError(err.message || "Unable to connect to kitchen API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInitialData();

    // Establish WebSocket Connection to /kitchen namespace
    socketRef.current = io("http://localhost:3001/kitchen");

    socketRef.current.on("connect", () => {
      console.log("Connected to /kitchen websocket namespace");
    });

    socketRef.current.on("dish:updated", (data: any) => {
      const incomingDishId = data.dishId || data.dish_id;
      const incomingCount = data.confirmedOrderCount !== undefined ? data.confirmedOrderCount : data.confirmed_order_count;
      const incomingPrepared = data.preparedQuantity !== undefined ? data.preparedQuantity : data.prepared_quantity;
      const incomingSoldOut = data.isSoldOut !== undefined ? data.isSoldOut : data.is_sold_out;

      if (!incomingDishId) return;

      setDishes((prevDishes) => {
        const index = prevDishes.findIndex((d) => d.dishId === incomingDishId);
        if (index === -1) return prevDishes;

        const updatedDishes = [...prevDishes];
        updatedDishes[index] = {
          ...updatedDishes[index],
          confirmedOrderCount: incomingCount ?? updatedDishes[index].confirmedOrderCount,
          preparedQuantity: incomingPrepared ?? updatedDishes[index].preparedQuantity,
          isSoldOut: incomingSoldOut ?? updatedDishes[index].isSoldOut,
        };
        return updatedDishes;
      });

      // Automatically reload tickets to pull new incoming orders
      void fetchTicketsSilently();
    });

    // Establish WebSocket Connection to /server-lookup namespace
    serverSocketRef.current = io("http://localhost:3001/server-lookup");

    serverSocketRef.current.on("order:item_collected", () => {
      void fetchTicketsSilently();
    });

    serverSocketRef.current.on("order:completed", () => {
      void fetchTicketsSilently();
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (serverSocketRef.current) serverSocketRef.current.disconnect();
    };
  }, []);

  const fetchTicketsSilently = async () => {
    const token = sessionStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/kitchen/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTickets(data);
      }
    } catch (err) {
      console.error("Error refreshing tickets silently", err);
    }
  };

  // Adjust Prepared Capacity Portions
  const adjustCapacity = async (dishId: string, currentQty: number, delta: number) => {
    const token = sessionStorage.getItem("token");
    const newQty = Math.max(0, currentQty + delta);
    setError("");

    try {
      const res = await fetch(`http://localhost:3001/menus/dishes/${dishId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preparedQuantity: newQty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update prepared quantity");
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle Sold Out Status
  const toggleSoldOut = async (dishId: string, currentSoldOut: boolean) => {
    const token = sessionStorage.getItem("token");
    setError("");

    try {
      // Toggle it using the generic edit endpoint to support restoring capacity
      const res = await fetch(`http://localhost:3001/menus/dishes/${dishId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isSoldOut: !currentSoldOut }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to toggle sold out state");
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle local checkbox state for ticket item preparation progress checklist
  const toggleCheckItem = (itemId: string) => {
    if (checkedItems.includes(itemId)) {
      setCheckedItems(checkedItems.filter((id) => id !== itemId));
    } else {
      setCheckedItems([...checkedItems, itemId]);
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ border: "4px solid #b7786b", borderTopColor: "transparent", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite", margin: "0 auto 15px" }}></div>
          <p style={{ fontFamily: "Libre Franklin", fontSize: "13px", fontWeight: 700, color: "#726a63" }}>Assembling kitchen display...</p>
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
              Kitchen Production Display
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>

            <button onClick={handleLogout} className="slide-btn" style={{ padding: "8px 18px", fontSize: "10px" }}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* DUAL COLUMN KITCHEN DISPLAY */}
      <main style={{ flexGrow: 1, padding: "40px", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
        {error && (
          <div style={{ backgroundColor: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "10px", color: "#DC2626", padding: "12px 20px", fontSize: "12px", fontWeight: "700", marginBottom: "25px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "40px", alignItems: "start" }}>
          
          {/* LEFT PANEL: Dishes & Portions Monitor (60% width) */}
          <div>
            <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "#726a63" }}>Active Menu Production</h2>
              <span style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.6)", fontWeight: "600" }}>{dishes.length} Dishes Published</span>
            </div>

            {dishes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 40px", backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px" }}>
                <p style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", color: "#726a63", marginBottom: "10px" }}>No Active Menu Published</p>
                <p style={{ fontSize: "12px", color: "rgba(114, 106, 99, 0.7)" }}>Publish the active catalog menu in the Admin Panel to populate dishes.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
                {dishes.map((dish) => {
                  const ratio = dish.preparedQuantity > 0 ? dish.confirmedOrderCount / dish.preparedQuantity : 0;
                  const percent = Math.min(100, Math.round(ratio * 100));

                  const isSoldOut = dish.isSoldOut || ratio >= 1.0;
                  const isAmber = !isSoldOut && ratio >= 0.8;

                  const cardBorderColor = isSoldOut ? "#DC2626" : isAmber ? "#C48000" : "rgba(114, 106, 99, 0.15)";
                  const cardBg = isSoldOut ? "rgba(220,38,38,0.02)" : isAmber ? "rgba(196,128,0,0.02)" : "#ffffff";
                  const primaryTextColor = isSoldOut ? "#DC2626" : isAmber ? "#C48000" : "#b7786b";

                  return (
                    <div
                      key={dish.dishId}
                      style={{ border: `1px solid ${cardBorderColor}`, backgroundColor: cardBg, borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.01)" }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "10px" }}>
                          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63", lineHeight: "1.4" }}>{dish.name}</h3>
                          {isSoldOut && (
                            <span style={{ fontSize: "8px", fontWeight: "700", backgroundColor: "#DC2626", color: "#ffffff", padding: "2px 6px", borderRadius: "4px" }}>SOLD OUT</span>
                          )}
                        </div>
                        {dish.description && (
                          <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px", lineHeight: "1.4" }}>{dish.description}</p>
                        )}
                      </div>

                      {/* Quantities display */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(114,106,99,0.08)", paddingTop: "15px" }}>
                        <div>
                          <span style={{ fontSize: "9px", textTransform: "uppercase", fontWeight: "700", color: "rgba(114, 106, 99, 0.5)", display: "block" }}>Orders</span>
                          <span style={{ fontSize: "28px", fontWeight: "900", fontFamily: "monospace", color: primaryTextColor }}>{dish.confirmedOrderCount}</span>
                        </div>

                        {/* Adjust Prepared Capacity */}
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "9px", textTransform: "uppercase", fontWeight: "700", color: "rgba(114, 106, 99, 0.5)", display: "block", marginBottom: "4px" }}>Capacity</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button onClick={() => void adjustCapacity(dish.dishId, dish.preparedQuantity, -5)} style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid rgba(114,106,99,0.2)", backgroundColor: "#ffffff", fontSize: "10px", fontWeight: "bold", cursor: "pointer", color: "#726a63" }}>-</button>
                            <span style={{ fontSize: "16px", fontWeight: "700", fontFamily: "monospace", color: "#726a63", minWidth: "24px", display: "inline-block", textAlign: "center" }}>{dish.preparedQuantity}</span>
                            <button onClick={() => void adjustCapacity(dish.dishId, dish.preparedQuantity, 5)} style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid rgba(114,106,99,0.2)", backgroundColor: "#ffffff", fontSize: "10px", fontWeight: "bold", cursor: "pointer", color: "#726a63" }}>+</button>
                          </div>
                        </div>
                      </div>

                      {/* Capacity progress bar */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ height: "6px", backgroundColor: "rgba(114, 106, 99, 0.08)", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${percent}%`, height: "100%", backgroundColor: cardBorderColor, transition: "width 0.3s ease" }}></div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: "700", color: "rgba(114, 106, 99, 0.5)" }}>
                          <span>{percent}% COOKED</span>
                          <span>{Math.max(0, dish.preparedQuantity - dish.confirmedOrderCount)} LEFT</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <button
                        onClick={() => void toggleSoldOut(dish.dishId, dish.isSoldOut)}
                        className="slide-btn"
                        style={{
                          width: "100%",
                          padding: "10px",
                          fontSize: "10px",
                          height: "auto",
                          backgroundColor: isSoldOut ? "transparent" : "#b7786b",
                          border: isSoldOut ? "1px solid #b7786b" : "none",
                          color: isSoldOut ? "#b7786b" : "#ffffff",
                          boxShadow: "none"
                        }}
                      >
                        {isSoldOut ? "Mark In Stock" : "Mark Sold Out"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Live Queue Pre-Order Tickets (40% width) */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px", position: "sticky", top: "130px", maxHeight: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(114,106,99,0.1)", paddingBottom: "15px", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "#726a63" }}>Incoming Prep Tickets</h2>
              {tickets.length > 0 && (
                <span style={{ fontSize: "10px", backgroundColor: "rgba(183, 120, 107, 0.15)", color: "#b7786b", padding: "3px 8px", borderRadius: "5px", fontWeight: "700" }}>
                  {tickets.length} PENDING
                </span>
              )}
            </div>

            <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "15px", paddingRight: "5px" }}>
              {tickets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 10px", color: "rgba(114,106,99,0.5)" }}>
                  <span style={{ display: "inline-flex", color: "#b7786b", opacity: 0.6, marginBottom: "12px", justifyContent: "center" }}>
                    <Inbox size={32} strokeWidth={1.8} />
                  </span>
                  <p style={{ fontSize: "11px", fontWeight: "700" }}>No incoming pre-orders queue.</p>
                  <p style={{ fontSize: "10px" }}>New counter orders or student pre-orders will display here instantly.</p>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.orderId}
                    style={{
                      border: "1px solid rgba(114, 106, 99, 0.12)",
                      borderRadius: "15px",
                      padding: "15px",
                      backgroundColor: "#faf9f7"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px dashed rgba(114,106,99,0.1)", paddingBottom: "8px" }}>
                      <div>
                        <span style={{ fontSize: "14px", fontWeight: "900", fontFamily: "monospace", color: "#b7786b" }}>#{ticket.referenceCode}</span>
                        <span style={{ fontSize: "9px", display: "block", color: "rgba(114,106,99,0.5)" }}>
                          {new Date(ticket.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114,106,99,0.5)" }}>
                        {ticket.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {ticket.items.map((item) => {
                        const isChecked = checkedItems.includes(item.itemId);
                        return (
                          <div
                            key={item.itemId}
                            onClick={() => toggleCheckItem(item.itemId)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                              opacity: isChecked ? 0.5 : 1,
                              transition: "all 0.2s"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div
                                style={{
                                  width: "16px",
                                  height: "16px",
                                  border: "1px solid rgba(114,106,99,0.4)",
                                  borderRadius: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: isChecked ? "#b7786b" : "#ffffff",
                                  borderColor: isChecked ? "#b7786b" : "rgba(114,106,99,0.4)",
                                  transition: "all 0.2s"
                                }}
                              >
                                {isChecked && <span style={{ color: "#ffffff", fontSize: "10px", fontWeight: "900" }}>✓</span>}
                              </div>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: "#726a63" }}>
                                {item.quantity}x {item.dishName}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="footer" style={{ marginTop: "auto" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(114,106,99,0.1)", flexWrap: "wrap", gap: "10px" }}>
          <p style={{ fontSize: "10px", color: "rgba(114,106,99,0.6)" }}>© {new Date().getFullYear()} CaféQ Strathmore Dining. All rights reserved.</p>
          <span style={{ fontSize: "9px", fontFamily: "monospace", backgroundColor: "rgba(114,106,99,0.06)", border: "1px solid rgba(114,106,99,0.1)", padding: "4px 10px", borderRadius: "5px", color: "rgba(114,106,99,0.8)" }}>
            Real-time feed synced over WebSockets namespace /kitchen
          </span>
        </div>
      </footer>

      {/* CSS KEYFRAMES */}
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
