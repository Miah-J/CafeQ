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

const DIETARY_FILTERS = ["Halal", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"];

export default function MenuBrowsing() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // 1. Authenticate check
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    setUser(JSON.parse(storedUser));

    // 2. Fetch Active Menu with Polling (5 seconds)
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
      } catch (err) {
        setError("Unable to connect to service. Checking connection...");
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
    <div className="min-h-screen bg-gradient-to-b from-[#140404] to-black text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-md px-6 py-4">
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
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-950/20 border border-red-500/30 p-3 text-sm text-red-200 text-center">
            {error}
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
                Today's Active Menu
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
                      {/* Name & Tags */}
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

                      {/* Dietary Labels */}
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
                      {/* Portion Status */}
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

                      {/* Order Button */}
                      <button
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
    </div>
  );
}
