"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  dietaryTags: string[] | null;
  preparedQuantity: number;
  isSoldOut: boolean;
  imageUrl: string | null;
}

interface Menu {
  id: string;
  publishDate: string;
  isActive: boolean;
  dishes: Dish[];
}

const DIETARY_TAG_OPTIONS = ["Halal", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"];

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"menus" | "staff">("menus");
  
  // Loading & Global Status
  const [globalLoading, setGlobalLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Menus Data
  const [menus, setMenus] = useState<Menu[]>([]);
  const [newMenuDate, setNewMenuDate] = useState("");
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editingMenuDate, setEditingMenuDate] = useState("");

  // Dish Forms Modal/States
  const [activeMenuIdForDish, setActiveMenuIdForDish] = useState<string | null>(null);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishPreparedQty, setDishPreparedQty] = useState("");
  const [dishTags, setDishTags] = useState<string[]>([]);
  const [dishImageUrl, setDishImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Staff Account Provision Forms
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Cashier");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [stationNumber, setStationNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [provisionLoading, setProvisionLoading] = useState(false);

  // Role Guard validation
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!userStr || !token) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== "Admin") {
        if (user.role === "Cashier") {
          router.push("/cashier");
        } else {
          router.push("/menu");
        }
      } else {
        setIsAdmin(true);
        void fetchAllMenus();
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  const fetchAllMenus = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/menus", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMenus(data);
      }
    } catch (err) {
      console.error("Failed to fetch menus:", err);
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  // Menu Handlers
  const handleCreateMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuDate) return;
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:3001/menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ publishDate: newMenuDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create menu.");
      setSuccess(`Menu for ${newMenuDate} created successfully!`);
      setNewMenuDate("");
      void fetchAllMenus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateMenuDate = async (menuId: string) => {
    if (!editingMenuDate) return;
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:3001/menus/${menuId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ publishDate: editingMenuDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update menu date.");
      setSuccess("Menu date updated successfully!");
      setEditingMenuId(null);
      setEditingMenuDate("");
      void fetchAllMenus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteMenu = async (menuId: string) => {
    if (!confirm("Are you sure you want to delete this menu? All associated dishes will be deleted.")) return;
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:3001/menus/${menuId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete menu.");
      setSuccess("Menu deleted successfully!");
      void fetchAllMenus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePublishMenu = async (menuId: string) => {
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:3001/menus/${menuId}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to publish menu.");
      setSuccess("Menu published successfully! It is now the active daily menu.");
      void fetchAllMenus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Dish Handlers
  const openAddDishModal = (menuId: string) => {
    setActiveMenuIdForDish(menuId);
    setEditingDishId(null);
    setDishName("");
    setDishDescription("");
    setDishPrice("");
    setDishPreparedQty("");
    setDishTags([]);
    setDishImageUrl(null);
  };

  const openEditDishModal = (menuId: string, dish: Dish) => {
    setActiveMenuIdForDish(menuId);
    setEditingDishId(dish.id);
    setDishName(dish.name);
    setDishDescription(dish.description || "");
    setDishPrice(String(dish.price));
    setDishPreparedQty(String(dish.preparedQuantity));
    setDishTags(dish.dietaryTags || []);
    setDishImageUrl(dish.imageUrl);
  };

  const closeDishModal = () => {
    setActiveMenuIdForDish(null);
    setEditingDishId(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("http://localhost:3001/menus/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload image.");
      setDishImageUrl(data.imageUrl);
    } catch (err) {
      alert("Image upload failed.");
      console.error(err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName || !dishPrice || !dishPreparedQty) return;
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    const payload = {
      name: dishName,
      description: dishDescription || undefined,
      price: Number(dishPrice),
      preparedQuantity: Number(dishPreparedQty),
      dietaryTags: dishTags.length > 0 ? dishTags : undefined,
      imageUrl: dishImageUrl || undefined,
    };

    try {
      let res;
      if (editingDishId) {
        res = await fetch(`http://localhost:3001/menus/dishes/${editingDishId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`http://localhost:3001/menus/${activeMenuIdForDish}/dishes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save dish.");

      setSuccess(`Successfully ${editingDishId ? "updated" : "added"} dish: ${dishName}`);
      closeDishModal();
      void fetchAllMenus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteDish = async (dishId: string) => {
    if (!confirm("Are you sure you want to remove this dish?")) return;
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:3001/menus/dishes/${dishId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete dish.");
      setSuccess("Dish removed successfully!");
      void fetchAllMenus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMarkSoldOut = async (dishId: string) => {
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:3001/menus/dishes/${dishId}/sold-out`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to mark dish sold out.");
      setSuccess("Dish marked as sold out!");
      void fetchAllMenus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleTag = (tag: string) => {
    if (dishTags.includes(tag)) {
      setDishTags(dishTags.filter((t) => t !== tag));
    } else {
      setDishTags([...dishTags, tag]);
    }
  };

  // Staff Account Provision Submission
  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setProvisionLoading(true);

    const token = localStorage.getItem("token");
    try {
      const payload: Record<string, string | undefined> = {
        email,
        password,
        fullName,
        role,
        phoneNumber: phoneNumber || undefined,
      };

      if (role === "Admin" && department) {
        payload.department = department;
      }
      if (role === "Cashier" && stationNumber) {
        payload.stationNumber = stationNumber;
      }

      const res = await fetch("http://localhost:3001/auth/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to provision user.");

      setSuccess(`Successfully provisioned new ${role}: ${fullName}!`);
      setFullName("");
      setEmail("");
      setPassword("");
      setPhoneNumber("");
      setStationNumber("");
      setDepartment("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProvisionLoading(false);
    }
  };

  if (!isAdmin || globalLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-ink font-sans">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-secondary text-xs font-bold">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-ink font-sans flex flex-col justify-between select-none">
      {/* Top Bar */}
      <header className="bg-primary px-6 py-4 sticky top-0 z-40 text-white shadow-sm flex items-center justify-between">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-extrabold tracking-tight hover:opacity-90 transition">
            CaféQ Admin Workspace
          </Link>
          <button
            onClick={handleLogout}
            className="rounded border border-white/30 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Sub Bar Tabs */}
      <section className="bg-white border-b border-secondary/20 px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab("menus")}
              className={`pb-1 text-sm font-bold border-b-2 transition cursor-pointer ${
                activeTab === "menus"
                  ? "border-primary text-primary"
                  : "border-transparent text-secondary hover:text-ink"
              }`}
            >
              Daily Menus
            </button>
            <button
              onClick={() => setActiveTab("staff")}
              className={`pb-1 text-sm font-bold border-b-2 transition cursor-pointer ${
                activeTab === "staff"
                  ? "border-primary text-primary"
                  : "border-transparent text-secondary hover:text-ink"
              }`}
            >
              Provision Accounts
            </button>
          </div>
          <p className="text-xs text-secondary font-semibold hidden md:block">
            Campus: <span className="text-primary font-bold">Strathmore Dining Services</span>
          </p>
        </div>
      </section>

      {/* Main Workspace */}
      <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-grow">
        
        {error && (
          <div className="mb-6 rounded-[10px] bg-status-sold-out/10 border border-status-sold-out/30 p-3.5 text-xs text-status-sold-out font-bold">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-600 font-bold">
            {success}
          </div>
        )}

        {/* TAB 1: MENU MANAGER */}
        {activeTab === "menus" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left: Create Menu Form */}
            <div className="lg:col-span-1 rounded-[10px] border border-secondary/20 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <h3 className="text-base font-bold text-primary mb-4 border-b border-secondary/15 pb-2">
                Create Daily Menu
              </h3>
              <form onSubmit={handleCreateMenu} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                    Publish Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newMenuDate}
                    onChange={(e) => setNewMenuDate(e.target.value)}
                    className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none transition"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-[10px] bg-primary py-2.5 text-xs font-bold text-white hover:bg-accent hover:text-ink transition cursor-pointer"
                >
                  Create Menu Draft
                </button>
              </form>
            </div>

            {/* Right/Center: Menus Listing */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-bold text-ink">Configured Daily Menus</h2>
              
              {menus.length === 0 ? (
                <div className="text-center py-12 rounded-[10px] border border-dashed border-secondary/20 bg-white text-secondary text-sm font-medium">
                  No menus have been created yet. Specify a publish date to begin.
                </div>
              ) : (
                menus.map((menu) => (
                  <div key={menu.id} className="rounded-[10px] border border-secondary/20 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)] space-y-4">
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-secondary/10 pb-3">
                      <div>
                        {editingMenuId === menu.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={editingMenuDate}
                              onChange={(e) => setEditingMenuDate(e.target.value)}
                              className="rounded border border-secondary/30 px-2 py-1 text-xs text-ink focus:outline-none"
                            />
                            <button
                              onClick={() => handleUpdateMenuDate(menu.id)}
                              className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded hover:bg-emerald-700 transition"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingMenuId(null)}
                              className="border border-secondary/30 text-secondary text-[10px] font-bold px-2.5 py-1.5 rounded hover:bg-secondary/5 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-3">
                            <h3 className="text-base font-bold text-ink">
                              Menu for: {new Date(menu.publishDate).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h3>
                            <button
                              onClick={() => {
                                setEditingMenuId(menu.id);
                                setEditingMenuDate(menu.publishDate);
                              }}
                              className="text-xs text-primary hover:underline font-semibold"
                            >
                              Edit Date
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] text-secondary font-medium uppercase tracking-wider mt-1">
                          ID: {menu.id}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {menu.isActive ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                            Active Menu
                          </span>
                        ) : (
                          <>
                            <span className="px-2.5 py-1 rounded bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-bold uppercase tracking-wider">
                              Draft
                            </span>
                            <button
                              onClick={() => handlePublishMenu(menu.id)}
                              className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded hover:bg-accent hover:text-ink transition cursor-pointer"
                            >
                              Publish
                            </button>
                            <button
                              onClick={() => handleDeleteMenu(menu.id)}
                              className="border border-status-sold-out/30 text-status-sold-out text-[10px] font-bold px-3 py-1.5 rounded hover:bg-status-sold-out/10 transition cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Menu Dishes */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-secondary">
                          Dishes List ({menu.dishes.length})
                        </h4>
                        {!menu.isActive && (
                          <button
                            onClick={() => openAddDishModal(menu.id)}
                            className="bg-white border border-secondary/35 text-secondary text-[10px] font-bold px-3 py-1.5 rounded hover:bg-secondary/5 transition cursor-pointer"
                          >
                            + Add Dish
                          </button>
                        )}
                      </div>

                      {menu.dishes.length === 0 ? (
                        <p className="text-xs text-secondary italic">No dishes in this menu yet. Click &apos;+ Add Dish&apos; to populate.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {menu.dishes.map((dish) => (
                            <div key={dish.id} className="border border-secondary/10 rounded-[10px] p-4 flex gap-4 bg-white relative">
                              {/* Dish Image */}
                              <div className="w-16 h-16 rounded-md bg-secondary/5 border border-secondary/15 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {dish.imageUrl ? (
                                  <img src={dish.imageUrl} alt={dish.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] text-secondary italic">No image</span>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <h5 className="font-bold text-xs text-ink truncate">{dish.name}</h5>
                                  <span className="font-bold text-xs text-primary shrink-0">KES {dish.price}</span>
                                </div>
                                <p className="text-[10px] text-secondary line-clamp-1 mb-2">{dish.description || "No description provided."}</p>
                                
                                <div className="flex items-center justify-between text-[9px] text-secondary font-medium">
                                  <span>Portions: <strong className="text-ink">{dish.preparedQuantity}</strong></span>
                                  {dish.isSoldOut ? (
                                    <span className="px-1.5 py-0.5 rounded bg-status-sold-out/15 text-status-sold-out font-bold uppercase tracking-wider">Sold Out</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold uppercase tracking-wider">Available</span>
                                  )}
                                </div>

                                {/* Dish Actions */}
                                {!menu.isActive && (
                                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-secondary/5">
                                    <button
                                      onClick={() => openEditDishModal(menu.id, dish)}
                                      className="text-[10px] font-bold text-secondary hover:text-primary transition"
                                    >
                                      Edit
                                    </button>
                                    <span className="text-secondary/30">|</span>
                                    <button
                                      onClick={() => handleDeleteDish(dish.id)}
                                      className="text-[10px] font-bold text-status-sold-out/85 hover:text-status-sold-out transition"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )}

                                {menu.isActive && !dish.isSoldOut && (
                                  <div className="mt-3 pt-2 border-t border-secondary/5 text-right">
                                    <button
                                      onClick={() => handleMarkSoldOut(dish.id)}
                                      className="text-[9px] font-bold bg-status-sold-out/10 border border-status-sold-out/30 text-status-sold-out px-2 py-1 rounded hover:bg-status-sold-out/20 transition cursor-pointer"
                                    >
                                      Flag Sold Out
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: STAFF ACCOUNT PROVISIONING */}
        {activeTab === "staff" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Main Provision Form */}
            <div className="lg:col-span-2 rounded-[10px] border border-secondary/20 bg-white p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <h2 className="text-lg font-bold mb-6 text-primary border-b border-secondary/15 pb-3">
                Provision Staff Account
              </h2>

              <form onSubmit={handleProvision} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                      Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full rounded-[10px] border border-secondary/30 bg-white px-4 py-3 text-sm text-ink focus:border-primary focus:outline-none transition appearance-none cursor-pointer"
                    >
                      <option value="Cashier">Cashier</option>
                      <option value="ServingStaff">Serving Staff</option>
                      <option value="KitchenStaff">Kitchen Staff</option>
                      <option value="Admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@strathmore.edu"
                      className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="07XXXXXXXX"
                    className="w-full rounded-[10px] border border-secondary/30 bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none transition"
                  />
                </div>

                {role === "Cashier" && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                      Station Number (Cashier Specific)
                    </label>
                    <input
                      type="text"
                      required
                      value={stationNumber}
                      onChange={(e) => setStationNumber(e.target.value)}
                      placeholder="e.g. ST-05"
                      className="w-full rounded-[10px] border border-accent bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none transition"
                    />
                  </div>
                )}

                {role === "Admin" && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                      Department (Admin Specific)
                    </label>
                    <input
                      type="text"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Finance / IT"
                      className="w-full rounded-[10px] border border-accent bg-transparent px-4 py-3 text-sm text-ink placeholder-secondary/50 focus:border-primary focus:outline-none transition"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={provisionLoading}
                  className="w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white shadow-sm hover:bg-accent hover:text-ink transition active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {provisionLoading ? "Provisioning..." : `Provision New ${role}`}
                </button>
              </form>
            </div>

            {/* Quick Info */}
            <div className="bg-white border border-secondary/20 rounded-[10px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
              <h3 className="text-base font-bold text-primary mb-3 border-b border-secondary/15 pb-2">
                Role Context & Rules
              </h3>
              <ul className="text-xs text-secondary space-y-4">
                <li>
                  <strong className="text-ink block mb-1">Cashier</strong>
                  Operates the Cashier Terminal workspace. Handles manual orders, CASH payments, and trigger-request of M-Pesa push transactions.
                </li>
                <li>
                  <strong className="text-ink block mb-1">Serving Staff</strong>
                  Operates the lookup station at the pick-up counter. Verifies pre-order reference codes and marks orders as collected.
                </li>
                <li>
                  <strong className="text-ink block mb-1">Kitchen Staff</strong>
                  Operates the Kitchen Display screen. Views incoming prep queues, marks dishes prepare counts, and monitors active items.
                </li>
                <li>
                  <strong className="text-ink block mb-1">Administrator</strong>
                  Has access to this dashboard, publishes/updates the daily menu catalog, flags sold-out portions, and provisions team accounts.
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Dish Modal Popup overlay */}
      {activeMenuIdForDish && (
        <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-secondary/20 w-full max-w-lg p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-ink border-b border-secondary/10 pb-3">
              {editingDishId ? "Modify Menu Dish" : "Add Dish to Menu"}
            </h3>

            <form onSubmit={handleSaveDish} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">
                  Dish Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Traditional Spicy Pilau"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full rounded-[10px] border border-secondary/30 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">
                  Description
                </label>
                <textarea
                  placeholder="Detailed description of the recipe..."
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-[10px] border border-secondary/30 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">
                    Price (KES)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="250"
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    className="w-full rounded-[10px] border border-secondary/30 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">
                    Prepared Portions
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="80"
                    value={dishPreparedQty}
                    onChange={(e) => setDishPreparedQty(e.target.value)}
                    className="w-full rounded-[10px] border border-secondary/30 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Dietary Selection */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-2">
                  Dietary Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY_TAG_OPTIONS.map((tag) => {
                    const active = dishTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded transition border cursor-pointer ${
                          active
                            ? "bg-accent/15 border-accent text-primary"
                            : "bg-transparent border-secondary/30 text-secondary hover:bg-secondary/5"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Meal Image Upload Section */}
              <div className="border border-secondary/15 rounded-[10px] p-4 bg-background/50 flex items-center gap-4">
                <div className="w-16 h-16 rounded bg-secondary/5 border border-secondary/15 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {dishImageUrl ? (
                    <img src={dishImageUrl} alt="Upload preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[9px] text-secondary italic text-center">No Image</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-secondary mb-1.5">
                    Upload Meal Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleImageUpload(e)}
                    className="block w-full text-xs text-secondary file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white file:cursor-pointer hover:file:opacity-90 file:transition"
                  />
                  {uploadingImage && <p className="text-[10px] text-primary font-bold mt-1 animate-pulse">Uploading file...</p>}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-secondary/10">
                <button
                  type="button"
                  onClick={closeDishModal}
                  className="rounded-[10px] border border-secondary/35 text-secondary text-xs font-bold px-4 py-2.5 hover:bg-secondary/5 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-[10px] bg-primary text-white text-xs font-bold px-5 py-2.5 hover:bg-accent hover:text-ink transition cursor-pointer"
                >
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-secondary/15 py-6 text-center text-[10px] text-secondary font-semibold bg-white px-6">
        <p>© {new Date().getFullYear()} CaféQ. Strathmore University Cafeteria. Kenya Data Protection Act 2019 Compliant.</p>
      </footer>
    </div>
  );
}
