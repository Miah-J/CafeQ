"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

interface KitchenDish {
  dishId: string;
  name: string;
  description: string | null;
  preparedQuantity: number;
  confirmedOrderCount: number;
  isSoldOut: boolean;
}

export default function KitchenDisplay() {
  const router = useRouter();
  const [dishes, setDishes] = useState<KitchenDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const socketRef = useRef<Socket | null>(null);

  // Authenticate user check (Admin, KitchenStaff, or ServingStaff)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

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

  // Live ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial dishes and bind socket listener
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchInitialDishes = async () => {
      try {
        const res = await fetch("http://localhost:3001/kitchen/dishes", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to load kitchen dishes");
        }

        setDishes(data);
        setError("");
      } catch (err: any) {
        setError(err.message || "Unable to connect to kitchen API.");
      } finally {
        setLoading(false);
      }
    };

    void fetchInitialDishes();

    // Establish WebSocket Connection
    socketRef.current = io("http://localhost:3001/kitchen");

    socketRef.current.on("connect", () => {
      console.log("Connected to /kitchen websocket namespace");
    });

    socketRef.current.on("dish:updated", (data: {
      dishId: string;
      dish_id?: string;
      confirmedOrderCount: number;
      confirmed_order_count?: number;
      preparedQuantity: number;
      prepared_quantity?: number;
      isSoldOut: boolean;
      is_sold_out?: boolean;
    }) => {
      const incomingDishId = data.dishId || data.dish_id;
      const incomingCount = data.confirmedOrderCount !== undefined ? data.confirmedOrderCount : data.confirmed_order_count;
      const incomingPrepared = data.preparedQuantity !== undefined ? data.preparedQuantity : data.prepared_quantity;
      const incomingSoldOut = data.isSoldOut !== undefined ? data.isSoldOut : data.is_sold_out;

      if (!incomingDishId) return;

      setDishes((prevDishes) => {
        const index = prevDishes.findIndex((d) => d.dishId === incomingDishId);
        if (index === -1) {
          return prevDishes;
        }

        const updatedDishes = [...prevDishes];
        updatedDishes[index] = {
          ...updatedDishes[index],
          confirmedOrderCount: incomingCount ?? updatedDishes[index].confirmedOrderCount,
          preparedQuantity: incomingPrepared ?? updatedDishes[index].preparedQuantity,
          isSoldOut: incomingSoldOut ?? updatedDishes[index].isSoldOut,
        };

        return updatedDishes;
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">
            Loading Kitchen Monitor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-ink font-sans flex flex-col justify-between overflow-hidden select-none p-6">
      {/* 1. Header Area */}
      <header className="bg-white border border-secondary/15 px-8 py-5 rounded-[10px] flex items-center justify-between mb-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-tight text-primary">CaféQ</span>
          <span className="h-5 w-px bg-secondary/20"></span>
          <span className="text-sm font-extrabold uppercase tracking-widest text-secondary/80">
            Kitchen Production Display
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-secondary/60 block mb-0.5">
              Active Session
            </span>
            <span className="text-xs font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-[10px]">
              Lunch (12:00 PM - 2:00 PM)
            </span>
          </div>

          <div className="h-10 w-px bg-secondary/20"></div>

          <div className="text-right font-mono">
            <span className="text-[10px] uppercase font-bold tracking-wider text-secondary/60 block mb-0.5">
              Live Time
            </span>
            <span className="text-lg font-black text-ink">{currentTime}</span>
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-grow flex flex-col justify-center">
        {error && (
          <div className="max-w-xl mx-auto w-full bg-status-sold-out/10 border border-status-sold-out/30 p-4 rounded-[10px] text-center text-xs text-status-sold-out font-bold mb-6">
            {error}
          </div>
        )}

        {dishes.length === 0 ? (
          <div className="text-center py-20 bg-white border border-secondary/15 rounded-[10px] max-w-xl mx-auto w-full shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <p className="text-secondary font-bold text-sm uppercase tracking-wider mb-2">
              No Active Menu Available
            </p>
            <p className="text-xs text-secondary/60">
              Dishes will appear here once the administrator publishes the daily menu.
            </p>
          </div>
        ) : (
          /* Grid of cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {dishes.map((dish) => {
              const ratio = dish.preparedQuantity > 0 ? dish.confirmedOrderCount / dish.preparedQuantity : 0;
              const percent = Math.min(100, Math.round(ratio * 100));

              // Threshold flags
              const isSoldOut = dish.isSoldOut || ratio >= 1.0;
              const isAmber = !isSoldOut && ratio >= 0.8;

              // Styles based on threshold
              const cardBorder = isSoldOut
                ? "border-status-sold-out bg-status-sold-out/5"
                : isAmber
                ? "border-status-low-stock bg-status-low-stock/5 text-ink"
                : "border-secondary/20 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)]";

              const countColor = isSoldOut
                ? "text-status-sold-out"
                : isAmber
                ? "text-status-low-stock"
                : "text-primary";

              const barColor = isSoldOut
                ? "bg-status-sold-out"
                : isAmber
                ? "bg-status-low-stock animate-pulse"
                : "bg-primary";

              return (
                <div
                  key={dish.dishId}
                  className={`border p-6 rounded-[10px] flex flex-col justify-between transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.01)] ${cardBorder}`}
                >
                  <div className="mb-6">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-base font-extrabold text-ink tracking-wide line-clamp-2">
                        {dish.name}
                      </h3>
                      {isSoldOut && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-status-sold-out text-white px-2 py-0.5 rounded animate-pulse shrink-0">
                          SOLD OUT
                        </span>
                      )}
                    </div>
                    {dish.description && (
                      <p className="text-xs text-secondary/70 leading-relaxed line-clamp-2">
                        {dish.description}
                      </p>
                    )}
                  </div>

                  {/* Order count stats */}
                  <div className="space-y-4">
                    <div className="flex items-end justify-between border-t border-secondary/15 pt-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-secondary/60 block mb-1">
                          Confirmed Orders
                        </span>
                        <span className={`text-4xl font-black font-mono leading-none ${countColor}`}>
                          {dish.confirmedOrderCount}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-secondary/60 block mb-1">
                          Prepared Qty
                        </span>
                        <span className="text-xl font-bold font-mono text-secondary">
                          {dish.preparedQuantity}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar container */}
                    <div className="space-y-1.5">
                      <div className="h-3 bg-secondary/10 rounded-full overflow-hidden border border-secondary/15 flex shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold font-mono text-secondary/60">
                        <span>{percent}% CAPACITY</span>
                        <span>{Math.max(0, dish.preparedQuantity - dish.confirmedOrderCount)} PORTIONS LEFT</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer Area */}
      <footer className="bg-white border border-secondary/15 rounded-[10px] py-5 text-center text-[10px] text-secondary/60 mt-8 px-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© {new Date().getFullYear()} CaféQ · Strathmore Informatics Dissertation Project</p>
          <p className="font-mono text-[9px] bg-background border border-secondary/10 px-2.5 py-1.5 rounded text-secondary/70">
            Real-time feed synced over WebSockets
          </p>
        </div>
      </footer>
    </div>
  );
}
