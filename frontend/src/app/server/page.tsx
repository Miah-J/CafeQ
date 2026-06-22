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
    <div className="min-h-screen bg-background text-ink font-sans flex flex-col justify-between selection:bg-primary/30">
      {/* Top Header */}
      <header className="bg-white border-b border-secondary/15 px-6 py-4 sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-wider text-primary hover:opacity-90 transition">
            CaféQ · Dispensing Tablet
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary px-3 py-1.5 rounded-[10px] border border-secondary/20">
              Station Active
            </span>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.push("/login");
              }}
              className="text-xs font-bold px-4 py-1.5 rounded-[10px] border border-secondary/35 hover:bg-secondary/10 transition text-secondary hover:text-ink"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Board */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-6 py-8 flex flex-col justify-center">
        {error && (
          <div className="mb-6 max-w-xl mx-auto w-full bg-status-sold-out/10 border border-status-sold-out/30 p-4 rounded-[10px] text-center text-xs text-status-sold-out font-bold">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 max-w-xl mx-auto w-full bg-emerald-50 border border-emerald-200 p-4 rounded-[10px] text-center text-xs text-emerald-800 font-bold">
            {successMsg}
          </div>
        )}

        {!order ? (
          /* State 1: Enter Reference Code Input view with virtual keypad */
          <div className="max-w-md w-full mx-auto bg-white border border-secondary/20 p-8 rounded-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase text-secondary tracking-widest mb-6">
              Enter Pickup Code
            </h2>

            {/* Typing input field form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (referenceCode.length === 6 && !loading) {
                  handleLookup();
                }
              }}
              className="w-full flex flex-col items-center"
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
                className="w-full h-16 bg-background rounded-[10px] border border-secondary/30 text-center text-3xl font-mono font-black tracking-[0.2em] text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition mb-6 shadow-inner placeholder-secondary/30 placeholder:tracking-normal"
              />

              {/* Keypad Grid (6 columns for A-Z, 0-9) */}
              <div className="grid grid-cols-6 gap-2 w-full mb-3">
                {keys.flat().map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="h-10 text-xs font-black rounded-[10px] bg-background border border-secondary/20 text-ink hover:bg-secondary/10 hover:border-primary/30 active:scale-95 transition flex items-center justify-center select-none"
                  >
                    {key}
                  </button>
                ))}
              </div>

              {/* Clear & Back controls */}
              <div className="grid grid-cols-2 gap-3 w-full mb-6">
                <button
                  type="button"
                  onClick={() => handleKeypadPress("CLEAR")}
                  className="h-11 text-xs font-bold rounded-[10px] bg-secondary/5 border border-secondary/25 text-secondary hover:bg-secondary/15 hover:text-ink active:scale-95 transition flex items-center justify-center select-none"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("BACK")}
                  className="h-11 text-xs font-bold rounded-[10px] bg-secondary/5 border border-secondary/25 text-secondary hover:bg-secondary/15 hover:text-ink active:scale-95 transition flex items-center justify-center select-none"
                >
                  BACKSPACE
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || referenceCode.length !== 6}
                className={`w-full py-4 rounded-[10px] font-bold text-sm transition tracking-wider ${
                  referenceCode.length === 6 && !loading
                    ? "bg-primary text-white hover:bg-accent hover:text-ink shadow-[0_2px_6px_rgba(188,91,57,0.1)] active:scale-98"
                    : "bg-secondary/10 border border-secondary/20 text-secondary/40 cursor-not-allowed"
                }`}
              >
                {loading ? "SEARCHING..." : "LOOKUP TICKET"}
              </button>
            </form>
          </div>
        ) : (
          /* State 2: Result details and list items */
          <div className="max-w-2xl w-full mx-auto bg-white border border-secondary/20 p-8 rounded-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between border-b border-secondary/15 pb-5 mb-6 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-secondary/60 block mb-1">
                  Pickup Reference
                </span>
                <span className="text-3xl font-black font-mono tracking-wider text-primary">
                  {order.referenceCode}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-widest text-secondary/60 block mb-1">
                  Customer Profile
                </span>
                <span className="text-base font-bold text-ink block">
                  {order.studentName}
                </span>
                <span className="text-xs text-secondary/70 font-mono">
                  ID: {order.studentNumber}
                </span>
              </div>
            </div>

            {/* List of items */}
            <div className="space-y-4 mb-8">
              <span className="text-[10px] uppercase font-bold tracking-widest text-secondary/60 block mb-2">
                Dishes in Order
              </span>
              {order.items.map((item) => {
                const isCollected = item.status === "COLLECTED";
                const isRefunded = item.status === "REFUNDED";

                return (
                  <div
                    key={item.orderItemId}
                    className={`flex items-center justify-between p-4 rounded-[10px] border transition-all duration-300 ${
                      isCollected
                        ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                        : isRefunded
                        ? "bg-secondary/5 border-secondary/10 opacity-60 text-secondary"
                        : "bg-background/40 border-secondary/20 hover:border-secondary/40 text-ink"
                    }`}
                  >
                    <div className="flex-grow pr-4">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-sm font-bold ${isCollected ? "text-emerald-750 line-through opacity-70" : isRefunded ? "text-secondary/60 line-through" : "text-ink"}`}>
                          {item.dishName}
                        </span>
                        <span className="bg-secondary/10 text-[10px] font-bold text-secondary px-2 py-0.5 rounded-[10px] border border-secondary/15">
                          x{item.quantity}
                        </span>
                      </div>
                      <span className="text-xs text-secondary/70">
                        Unit Price: KES {item.unitPrice.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      {isCollected ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100/40 border border-emerald-200 px-3 py-1.5 rounded-[10px] flex items-center gap-1.5">
                          ✓ Dispensed
                        </span>
                      ) : isRefunded ? (
                        <span className="text-xs font-bold text-secondary bg-secondary/10 border border-secondary/25 px-3 py-1.5 rounded-[10px]">
                          Refunded
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarkCollected(item.orderItemId)}
                          className="text-xs font-bold bg-primary text-white hover:bg-accent hover:text-ink px-4 py-2 rounded-[10px] transition active:scale-95 shadow-[0_2px_4px_rgba(188,91,57,0.1)]"
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
            <div className="flex items-center justify-between pt-4 border-t border-secondary/15">
              <div className="flex items-center gap-2 text-xs text-secondary font-medium">
                <span>Order Status:</span>
                <span
                  className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded-[10px] ${
                    order.status === "COLLECTED"
                      ? "text-emerald-700 bg-emerald-50"
                      : order.status === "REFUNDED"
                      ? "text-secondary bg-secondary/15"
                      : "text-accent bg-accent/10"
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <button
                onClick={handleReset}
                className="text-xs font-bold bg-secondary/10 hover:bg-secondary/15 text-secondary hover:text-ink border border-secondary/25 px-5 py-2.5 rounded-[10px] transition active:scale-95"
              >
                ← Dispense New Ticket
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white py-6 text-center text-[10px] text-secondary/60 border-t border-secondary/15 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© {new Date().getFullYear()} CaféQ · Strathmore University Dining Hall</p>
          <p className="font-mono text-[9px] bg-background px-2.5 py-1 rounded border border-secondary/10 text-secondary/70">
            Connected via secure Socket.IO channel
          </p>
        </div>
      </footer>
    </div>
  );
}
