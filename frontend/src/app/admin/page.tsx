"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  TrendingUp, 
  Award, 
  UserPlus 
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"overview" | "menus" | "reports" | "loyalty" | "staff">("overview");
  
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

  // Analytics and Loyalty Stats Data
  const [revenueStats, setRevenueStats] = useState<{ totalRevenue: number; salesByDish: Array<{ dishName: string; sales: number }> } | null>(null);
  const [orderStats, setOrderStats] = useState<{ totalPlaced: number; totalCollected: number; collectionRate: number } | null>(null);
  const [dishDemand, setDishDemand] = useState<Array<{ dishId: string; name: string; forecastedQty: number; preparedQty: number; confirmedQty: number; remainingQty: number; collectionRate: number }>>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Array<{ dishId: string; name: string; preparedQuantity: number; remainingQuantity: number; lowStockAt: string | null; soldOutAt: string | null; isSoldOut: boolean }>>([]);
  const [loyaltyStats, setLoyaltyStats] = useState<{ totalPointsIssued: number; totalPointsRedeemed: number; activeAccountsCount: number; frozenAccountsCount: number; eligibleAccountsCount: number } | null>(null);

  // Data Fetchers
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

  const fetchRevenueStats = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/analytics/revenue", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRevenueStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch revenue stats:", err);
    }
  };

  const fetchOrderStats = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/analytics/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrderStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch order stats:", err);
    }
  };

  const fetchDishDemand = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/analytics/dish-demand", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDishDemand(data.dishes || []);
      }
    } catch (err) {
      console.error("Failed to fetch dish demand:", err);
    }
  };

  const fetchLowStockAlerts = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/analytics/low-stock", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLowStockAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error("Failed to fetch low stock alerts:", err);
    }
  };

  const fetchLoyaltyStats = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/loyalty/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLoyaltyStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch loyalty stats:", err);
    }
  };

  const handleApplyForecast = async (dishId: string, recommendedQty: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`http://localhost:3001/menus/dishes/${dishId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preparedQuantity: recommendedQty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to adjust prepared quantity.");
      setSuccess(`Adjusted prepared portions to ${recommendedQty} successfully!`);
      void fetchDishDemand();
      void fetchAllMenus();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportCsv = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/analytics/export-csv", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cafeq_orders_revenue_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccess("CSV exported and downloaded successfully.");
      } else {
        setError("Failed to export CSV file.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Role Guard validation & Data Polling
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
        
        const loadAll = () => {
          void fetchAllMenus();
          void fetchRevenueStats();
          void fetchOrderStats();
          void fetchDishDemand();
          void fetchLowStockAlerts();
          void fetchLoyaltyStats();
        };
        
        loadAll();
        const pollInterval = setInterval(loadAll, 5000);
        return () => clearInterval(pollInterval);
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

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
      <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ border: "4px solid #b7786b", borderTopColor: "transparent", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite", margin: "0 auto 15px" }}></div>
          <p style={{ fontFamily: "Libre Franklin", fontSize: "13px", fontWeight: 700, color: "#726a63" }}>Verifying authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f8f7f6", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      
      {/* ANNOUNCEMENT BAR (MARQUEE) */}
      <div className="announcement-bar">
        <div className="announcement-bar__content">
          <span className="announcement-bar__item">Strathmore University Dining</span>
          <span className="announcement-bar__item">CaféQ System Administrator Portal</span>
          <span className="announcement-bar__item">Predictive Demand Forecast Optimization</span>
          <span className="announcement-bar__item">Provision Staff Credentials & Daily Menus</span>
          {/* Repeated for marquee loop */}
          <span className="announcement-bar__item">Strathmore University Dining</span>
          <span className="announcement-bar__item">CaféQ System Administrator Portal</span>
          <span className="announcement-bar__item">Predictive Demand Forecast Optimization</span>
          <span className="announcement-bar__item">Provision Staff Credentials & Daily Menus</span>
        </div>
      </div>

      {/* HEADER */}
      <header className="header-wrapper">
        <div className="header-top" style={{ padding: "15px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="logo">CAFÉQ</span>
            <span style={{ height: "16px", width: "1px", backgroundColor: "rgba(114, 106, 99, 0.2)", margin: "0 10px" }}></span>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.6)" }}>
              Admin Workspace
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
            <button onClick={handleLogout} className="nav-link" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flexGrow: 1, minHeight: "calc(100vh - 120px)" }}>
        {/* Sticky Left Sidebar Console */}
        <aside style={{ width: "260px", backgroundColor: "#ffffff", borderRight: "1px solid rgba(114, 106, 99, 0.12)", padding: "35px 24px", display: "flex", flexDirection: "column", gap: "25px", flexShrink: 0 }}>
          <div style={{ marginBottom: "5px" }}>
            <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.4)" }}>Admin Navigation</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { id: "overview", label: "Overview", icon: <LayoutDashboard size={15} strokeWidth={2.2} /> },
              { id: "menus", label: "Menu Manager", icon: <UtensilsCrossed size={15} strokeWidth={2.2} /> },
              { id: "reports", label: "Reports & Forecasts", icon: <TrendingUp size={15} strokeWidth={2.2} /> },
              { id: "loyalty", label: "Loyalty Program", icon: <Award size={15} strokeWidth={2.2} /> },
              { id: "staff", label: "Provision Staff", icon: <UserPlus size={15} strokeWidth={2.2} /> }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    background: active ? "rgba(183, 120, 107, 0.08)" : "none",
                    border: "none",
                    borderLeft: active ? "3px solid #b7786b" : "3px solid transparent",
                    padding: "12px 15px",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: active ? "#b7786b" : "#726a63",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    borderRadius: "0 6px 6px 0",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px"
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: active ? "#b7786b" : "rgba(114, 106, 99, 0.6)" }}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: "auto", borderTop: "1px solid rgba(114,106,99,0.08)", paddingTop: "25px" }}>
            <span style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "rgba(114,106,99,0.4)", marginBottom: "6px" }}>Strathmore Campus</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10B981" }}></span>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#726a63" }}>System Active</span>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE */}
        <main className="main-content" style={{ flexGrow: 1, padding: "40px", overflowY: "auto" }}>
        
        {error && (
          <div style={{ backgroundColor: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "10px", color: "#DC2626", padding: "12px 20px", fontSize: "12px", fontWeight: "700", marginBottom: "25px", textAlign: "center" }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "10px", color: "#10B981", padding: "12px 20px", fontSize: "12px", fontWeight: "700", marginBottom: "25px", textAlign: "center" }}>
            {success}
          </div>
        )}

        {/* TAB: OVERVIEW */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            
            {/* KPI Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Live Revenue</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#b7786b", marginTop: "10px" }}>
                  KES {(revenueStats?.totalRevenue || 0).toLocaleString()}
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Confirmed & collected orders</span>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Total Orders Placed</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#726a63", marginTop: "10px" }}>
                  {orderStats?.totalPlaced || 0}
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>All states combined</span>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Orders Collected</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#10B981", marginTop: "10px" }}>
                  {orderStats?.totalCollected || 0}
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Handed over to students</span>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Collection Rate</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#b7786b", marginTop: "10px" }}>
                  {orderStats?.collectionRate || 0}%
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Target: &gt;95% collection</span>
              </div>
            </div>

            {/* Split layout: Preparation Recommendations & Live Low Stock Alerts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "30px" }} className="grid lg:grid-cols-3">
              
              {/* Left/Center: Demand Forecasting recommendations */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px" }} className="lg:col-span-2">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(114,106,99,0.15)", paddingBottom: "12px", marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63" }}>
                    Preparation Recommendations (FastAPI Demand Forecast Model)
                  </h3>
                  <span style={{ fontSize: "8px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(183, 120, 107, 0.08)", border: "1px solid rgba(183, 120, 107, 0.2)", padding: "4px 10px", borderRadius: "5px", color: "#b7786b" }}>
                    ML-Powered
                  </span>
                </div>
                
                {dishDemand.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", fontSize: "12px", color: "rgba(114, 106, 99, 0.6)", fontStyle: "italic" }}>
                    No active daily menu found. Publish a menu to view forecasting recommendations.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", color: "#726a63", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(114, 106, 99, 0.15)", textTransform: "uppercase", fontSize: "9px", fontWeight: "700", color: "rgba(114, 106, 99, 0.5)" }}>
                          <th style={{ padding: "12px 10px" }}>Dish Name</th>
                          <th style={{ padding: "12px 10px", textAlign: "center" }}>Current Prep Qty</th>
                          <th style={{ padding: "12px 10px", textAlign: "center", color: "#b7786b" }}>Model Forecast</th>
                          <th style={{ padding: "12px 10px", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dishDemand.map((dish) => (
                          <tr key={dish.dishId} style={{ borderBottom: "1px solid rgba(114, 106, 99, 0.08)" }}>
                            <td style={{ padding: "16px 10px", fontWeight: "700", color: "#726a63" }}>{dish.name}</td>
                            <td style={{ padding: "16px 10px", textAlign: "center" }}>{dish.preparedQty} portions</td>
                            <td style={{ padding: "16px 10px", textAlign: "center", color: "#b7786b", fontWeight: "900" }}>{dish.forecastedQty} portions</td>
                            <td style={{ padding: "16px 10px", textAlign: "right" }}>
                              {dish.preparedQty === dish.forecastedQty ? (
                                <span style={{ fontSize: "10px", color: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "4px 10px", borderRadius: "30px", fontWeight: "700" }}>
                                  ✓ Aligned
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleApplyForecast(dish.dishId, dish.forecastedQty)}
                                  className="slide-btn"
                                  style={{ padding: "6px 15px", fontSize: "10px", height: "auto" }}
                                >
                                  Apply Forecast
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right: Live Low-Stock Notifications */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px" }} className="lg:col-span-1">
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63", borderBottom: "1px solid rgba(114,106,99,0.15)", paddingBottom: "12px", marginBottom: "20px" }}>
                  Live Stock Alerts
                </h3>

                {lowStockAlerts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", fontSize: "12px", color: "rgba(114, 106, 99, 0.6)", fontStyle: "italic" }}>
                    ✓ All active menu portions are healthy.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px", maxHeight: "400px", overflowY: "auto" }}>
                    {lowStockAlerts.map((alert) => {
                      const isSoldOut = alert.remainingQuantity === 0 || alert.isSoldOut;
                      return (
                        <div key={alert.dishId} style={{
                          borderRadius: "15px",
                          border: isSoldOut ? "1px solid rgba(220,38,38,0.2)" : "1px solid rgba(196,128,0,0.2)",
                          backgroundColor: isSoldOut ? "rgba(220,38,38,0.03)" : "rgba(196,128,0,0.03)",
                          padding: "15px",
                          fontSize: "12px"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            <span style={{ fontWeight: "700", color: "#726a63" }}>{alert.name}</span>
                            <span style={{ fontSize: "8px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: isSoldOut ? "#DC2626" : "#C48000", color: "#ffffff", padding: "2px 6px", borderRadius: "5px" }}>
                              {isSoldOut ? 'Sold Out' : 'Low Stock'}
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", marginTop: "10px" }}>
                            <span>Prepared: {alert.preparedQuantity}</span>
                            <span style={{ color: isSoldOut ? '#DC2626' : '#C48000' }}>Remaining: {alert.remainingQuantity}</span>
                          </div>

                          <div style={{ marginTop: "10px", fontSize: "9px", color: "rgba(114, 106, 99, 0.5)", borderTop: "1px solid rgba(114, 106, 99, 0.08)", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
                            <span>Triggered:</span>
                            <span>
                              {isSoldOut 
                                ? alert.soldOutAt ? new Date(alert.soldOutAt).toLocaleTimeString() : 'Just now'
                                : alert.lowStockAt ? new Date(alert.lowStockAt).toLocaleTimeString() : 'Just now'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: REPORTS */}
        {activeTab === "reports" && (
          <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(114,106,99,0.15)", paddingBottom: "15px", marginBottom: "20px", gap: "15px" }}>
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63" }}>
                  Dish Demand Comparison & Analytics
                </h3>
                <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.6)", marginTop: "4px" }}>
                  Compare forecasted, prepared, and confirmed orders to optimize waste and collection rates.
                </p>
              </div>
              <button onClick={handleExportCsv} className="slide-btn" style={{ padding: "8px 18px", fontSize: "11px", height: "auto" }}>
                📥 Export Orders & Revenue CSV
              </button>
            </div>

            {dishDemand.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", fontSize: "12px", color: "rgba(114, 106, 99, 0.6)", fontStyle: "italic" }}>
                No active menu found. Publish a daily menu to inspect historical and live metrics.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", color: "#726a63", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(114, 106, 99, 0.15)", textTransform: "uppercase", fontSize: "9px", fontWeight: "700", color: "rgba(114, 106, 99, 0.5)" }}>
                      <th style={{ padding: "12px 10px" }}>Dish Name</th>
                      <th style={{ padding: "12px 10px", textAlign: "center" }}>Forecasted Qty</th>
                      <th style={{ padding: "12px 10px", textAlign: "center" }}>Prepared Qty</th>
                      <th style={{ padding: "12px 10px", textAlign: "center" }}>Confirmed Orders</th>
                      <th style={{ padding: "12px 10px", textAlign: "center" }}>Remaining Portions</th>
                      <th style={{ padding: "12px 10px", textAlign: "center" }}>Ratio (Ordered/Prep)</th>
                      <th style={{ padding: "12px 10px", textAlign: "right" }}>Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dishDemand.map((dish) => {
                      const ratio = dish.preparedQty > 0 ? (dish.confirmedQty / dish.preparedQty) * 100 : 0;
                      const isHighDemand = ratio >= 80;
                      return (
                        <tr key={dish.dishId} style={{ borderBottom: "1px solid rgba(114, 106, 99, 0.08)", backgroundColor: isHighDemand ? "rgba(183,120,107,0.02)" : "transparent" }}>
                          <td style={{ padding: "14px 10px", fontWeight: "700", color: "#726a63" }}>{dish.name}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>{dish.forecastedQty}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>{dish.preparedQty}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center", fontWeight: "700", color: "#726a63" }}>{dish.confirmedQty}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>{dish.remainingQty}</td>
                          <td style={{ padding: "14px 10px", textAlign: "center" }}>
                            <span style={{
                              fontSize: "9px",
                              fontWeight: "750",
                              backgroundColor: isHighDemand ? "rgba(183, 120, 107, 0.08)" : "rgba(114, 106, 99, 0.06)",
                              border: isHighDemand ? "1px solid rgba(183, 120, 107, 0.2)" : "1px solid rgba(114, 106, 99, 0.1)",
                              color: isHighDemand ? "#b7786b" : "#726a63",
                              padding: "2px 8px",
                              borderRadius: "10px"
                            }}>
                              {ratio.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ padding: "14px 10px", textAlign: "right", color: "#10B981", fontWeight: "700" }}>{dish.collectionRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: LOYALTY PROGRAM */}
        {activeTab === "loyalty" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            
            {/* Loyalty KPI Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Total Points Issued</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#b7786b", marginTop: "10px" }}>
                  {loyaltyStats?.totalPointsIssued || 0} pts
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Earned by Strathmore students</span>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Total Points Redeemed</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#10B981", marginTop: "10px" }}>
                  {loyaltyStats?.totalPointsRedeemed || 0} pts
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Equivalent KES discount credit</span>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Active Loyalty Accounts</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#726a63", marginTop: "10px" }}>
                  {loyaltyStats?.activeAccountsCount || 0}
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Valid registered accounts</span>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Frozen Accounts</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#DC2626", marginTop: "10px" }}>
                  {loyaltyStats?.frozenAccountsCount || 0}
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Negative balance locks</span>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>Redemption Eligible</span>
                <span style={{ fontSize: "24px", fontWeight: "950", color: "#b7786b", marginTop: "10px" }}>
                  {loyaltyStats?.eligibleAccountsCount || 0}
                </span>
                <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>Accounts with balance &gt;= 50 pts</span>
              </div>
            </div>

            {/* Loyalty Rules & Summary card */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63", borderBottom: "1px solid rgba(114,106,99,0.15)", paddingBottom: "12px", marginBottom: "20px" }}>
                CaféQ Loyalty System Parameter Rules
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }} className="grid md:grid-cols-3">
                <div style={{ padding: "18px", backgroundColor: "#faf9f7", borderRadius: "15px", border: "1px solid rgba(114, 106, 99, 0.1)" }}>
                  <strong style={{ color: "#726a63", fontSize: "13px", display: "block", marginBottom: "5px" }}>Earning Parameters</strong>
                  <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.8)", lineHeight: "1.5" }}>
                    Students earn 1 loyalty point for every KES 10 spent on fully collected orders. Values are rounded down to the nearest point on order finalization.
                  </p>
                </div>
                <div style={{ padding: "18px", backgroundColor: "#faf9f7", borderRadius: "15px", border: "1px solid rgba(114, 106, 99, 0.1)" }}>
                  <strong style={{ color: "#726a63", fontSize: "13px", display: "block", marginBottom: "5px" }}>Redemption Parameters</strong>
                  <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.8)", lineHeight: "1.5" }}>
                    1 point corresponds to a KES 1.00 checkout discount. Minimum redemption is 50 points; maximum redemption is 30% of the total order value. Accounts are limited to 3 redemptions per calendar day.
                  </p>
                </div>
                <div style={{ padding: "18px", backgroundColor: "#faf9f7", borderRadius: "15px", border: "1px solid rgba(114, 106, 99, 0.1)" }}>
                  <strong style={{ color: "#726a63", fontSize: "13px", display: "block", marginBottom: "5px" }}>Deduction & Frozen States</strong>
                  <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.8)", lineHeight: "1.5" }}>
                    Points earned are proportionally deducted if uncollected dishes are auto-refunded at the end of the serving window. If the balance falls below zero, the account status is set to FROZEN.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: MENU MANAGER */}
        {activeTab === "menus" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "30px" }} className="grid lg:grid-cols-3">
            
            {/* Left: Create Menu Form */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px" }} className="lg:col-span-1">
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63", borderBottom: "1px solid rgba(114,106,99,0.15)", paddingBottom: "12px", marginBottom: "20px" }}>
                Create Daily Menu
              </h3>
              <form onSubmit={handleCreateMenu} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div>
                  <label htmlFor="publishDateInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                    Publish Date
                  </label>
                  <input
                    id="publishDateInput"
                    type="date"
                    required
                    value={newMenuDate}
                    onChange={(e) => setNewMenuDate(e.target.value)}
                    style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                  />
                </div>
                <button type="submit" className="slide-btn" style={{ width: "100%", height: "45px" }}>
                  Create Menu Draft
                </button>
              </form>
            </div>

            {/* Right/Center: Menus Listing */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="lg:col-span-2">
              <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#726a63" }}>Configured Daily Menus</h2>
              
              {menus.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", fontSize: "12px", color: "rgba(114, 106, 99, 0.6)" }}>
                  No menus have been created yet. Specify a publish date to begin.
                </div>
              ) : (
                menus.map((menu) => (
                  <div key={menu.id} style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Card Header */}
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(114,106,99,0.1)", paddingBottom: "12px", gap: "10px" }}>
                      <div>
                        {editingMenuId === menu.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <input
                              type="date"
                              value={editingMenuDate}
                              onChange={(e) => setEditingMenuDate(e.target.value)}
                              style={{ padding: "6px 12px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "11px" }}
                            />
                            <button
                              onClick={() => handleUpdateMenuDate(menu.id)}
                              className="slide-btn"
                              style={{ padding: "6px 12px", fontSize: "10px", height: "auto" }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingMenuId(null)}
                              className="slide-btn"
                              style={{ padding: "6px 12px", fontSize: "10px", height: "auto", backgroundColor: "transparent", border: "1px solid rgba(114,106,99,0.3)", color: "#726a63", boxShadow: "none" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63" }}>
                              Menu for: {new Date(menu.publishDate).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h3>
                            <button
                              onClick={() => {
                                setEditingMenuId(menu.id);
                                setEditingMenuDate(menu.publishDate);
                              }}
                              style={{ background: "none", border: "none", color: "#b7786b", fontSize: "11px", fontWeight: "700", cursor: "pointer", textDecoration: "underline" }}
                            >
                              Edit Date
                            </button>
                          </div>
                        )}
                        <p style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(114, 106, 99, 0.5)", marginTop: "4px" }}>
                          ID: {menu.id}
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {menu.isActive ? (
                          <span style={{ fontSize: "9px", fontWeight: "750", textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "4px 12px", borderRadius: "30px", color: "#10B981" }}>
                            Active Menu
                          </span>
                        ) : (
                          <>
                            <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(114, 106, 99, 0.08)", border: "1px solid rgba(114, 106, 99, 0.15)", padding: "4px 12px", borderRadius: "30px", color: "rgba(114, 106, 99, 0.7)" }}>
                              Draft
                            </span>
                            <button
                              onClick={() => handlePublishMenu(menu.id)}
                              className="slide-btn"
                              style={{ padding: "6px 15px", fontSize: "10px", height: "auto" }}
                            >
                              Publish
                            </button>
                            <button
                              onClick={() => handleDeleteMenu(menu.id)}
                              className="slide-btn"
                              style={{ padding: "6px 15px", fontSize: "10px", height: "auto", backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#DC2626", boxShadow: "none" }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Menu Dishes */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h4 style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(114, 106, 99, 0.6)" }}>
                          Dishes in Menu ({menu.dishes.length})
                        </h4>
                        <button
                          onClick={() => openAddDishModal(menu.id)}
                          className="slide-btn"
                          style={{ padding: "6px 15px", fontSize: "10px", height: "auto", backgroundColor: "transparent", border: "1px solid rgba(114,106,99,0.3)", color: "#726a63", boxShadow: "none" }}
                        >
                          + Add Dish
                        </button>
                      </div>

                      {menu.dishes.length === 0 ? (
                        <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.5)", fontStyle: "italic" }}>No dishes in this menu yet. Click '+ Add Dish' to populate.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "15px" }}>
                          {menu.dishes.map((dish) => (
                            <div key={dish.id} style={{ border: "1px solid rgba(114, 106, 99, 0.12)", borderRadius: "15px", padding: "15px", display: "flex", gap: "12px", backgroundColor: "#ffffff" }}>
                              
                              {/* Dish Image */}
                              <div style={{ width: "50px", height: "50px", borderRadius: "8px", overflow: "hidden", backgroundColor: "rgba(114,106,99,0.05)", border: "1px solid rgba(114,106,99,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {dish.imageUrl ? (
                                  <img src={dish.imageUrl} alt={dish.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.5)", fontStyle: "italic" }}>No image</span>
                                )}
                              </div>

                              <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "6px" }}>
                                    <h5 style={{ fontSize: "12px", fontWeight: "700", color: "#726a63", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dish.name}</h5>
                                    <span style={{ fontSize: "12px", fontWeight: "750", color: "#b7786b" }}>KES {dish.price}</span>
                                  </div>
                                  <p style={{ fontSize: "10px", color: "rgba(114, 106, 99, 0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: "3px 0 6px" }}>{dish.description || "No description."}</p>
                                  
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "9px" }}>
                                    <span>Portions: <strong style={{ color: "#726a63" }}>{dish.preparedQuantity}</strong></span>
                                    {dish.isSoldOut ? (
                                      <span style={{ fontSize: "8px", fontWeight: "700", backgroundColor: "#DC2626", color: "#ffffff", padding: "2px 6px", borderRadius: "5px" }}>SOLD OUT</span>
                                    ) : (
                                      <span style={{ fontSize: "8px", fontWeight: "700", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981", padding: "2px 6px", borderRadius: "5px" }}>AVAILABLE</span>
                                    )}
                                  </div>
                                </div>

                                {/* Dish Actions */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(114, 106, 99, 0.08)", paddingTop: "8px", marginTop: "10px" }}>
                                  <div style={{ display: "flex", gap: "8px", fontSize: "10px" }}>
                                    <button
                                      onClick={() => openEditDishModal(menu.id, dish)}
                                      style={{ background: "none", border: "none", color: "#726a63", fontWeight: "700", cursor: "pointer" }}
                                    >
                                      Edit
                                    </button>
                                    <span style={{ color: "rgba(114, 106, 99, 0.3)" }}>|</span>
                                    <button
                                      onClick={() => handleDeleteDish(dish.id)}
                                      style={{ background: "none", border: "none", color: "#DC2626", fontWeight: "700", cursor: "pointer" }}
                                    >
                                      Remove
                                    </button>
                                  </div>

                                  {menu.isActive && !dish.isSoldOut && (
                                    <button
                                      onClick={() => handleMarkSoldOut(dish.id)}
                                      style={{ fontSize: "8px", fontWeight: "700", border: "1px solid rgba(220,38,38,0.2)", backgroundColor: "rgba(220,38,38,0.05)", color: "#DC2626", padding: "3px 8px", borderRadius: "5px", cursor: "pointer" }}
                                    >
                                      Flag Sold Out
                                    </button>
                                  )}
                                </div>

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "30px" }} className="grid lg:grid-cols-3">
            {/* Main Provision Form */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "30px" }} className="lg:col-span-2">
              <h2 style={{ fontSize: "15px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "#726a63", borderBottom: "1px solid rgba(114,106,99,0.15)", paddingBottom: "12px", marginBottom: "25px" }}>
                Provision Staff Account
              </h2>

              <form onSubmit={handleProvision} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label htmlFor="staffNameInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                      Full Name
                    </label>
                    <input
                      id="staffNameInput"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                    />
                  </div>

                  <div style={{ flex: "1 1 200px" }}>
                    <label htmlFor="staffRoleSelect" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                      Role
                    </label>
                    <select
                      id="staffRoleSelect"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "#ffffff", cursor: "pointer" }}
                    >
                      <option value="Cashier">Cashier</option>
                      <option value="ServingStaff">Serving Staff</option>
                      <option value="KitchenStaff">Kitchen Staff</option>
                      <option value="Admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label htmlFor="staffEmailInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                      Email Address
                    </label>
                    <input
                      id="staffEmailInput"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@strathmore.edu"
                      style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                    />
                  </div>

                  <div style={{ flex: "1 1 200px" }}>
                    <label htmlFor="staffPasswordInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                      Password
                    </label>
                    <input
                      id="staffPasswordInput"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="staffPhoneInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                    Phone Number (Optional)
                  </label>
                  <input
                    id="staffPhoneInput"
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="07XXXXXXXX"
                    style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                  />
                </div>

                {role === "Cashier" && (
                  <div>
                    <label htmlFor="staffStationInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "#b7786b", marginBottom: "8px" }}>
                      Station Number (Cashier Specific)
                    </label>
                    <input
                      id="staffStationInput"
                      type="text"
                      required
                      value={stationNumber}
                      onChange={(e) => setStationNumber(e.target.value)}
                      placeholder="e.g. ST-05"
                      style={{ width: "100%", padding: "10px 15px", border: "1px solid #b7786b", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                    />
                  </div>
                )}

                {role === "Admin" && (
                  <div>
                    <label htmlFor="staffDeptInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "#b7786b", marginBottom: "8px" }}>
                      Department (Admin Specific)
                    </label>
                    <input
                      id="staffDeptInput"
                      type="text"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Finance / IT"
                      style={{ width: "100%", padding: "10px 15px", border: "1px solid #b7786b", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                    />
                  </div>
                )}

                <button type="submit" disabled={provisionLoading} className="slide-btn" style={{ width: "100%", height: "48px" }}>
                  {provisionLoading ? "Provisioning..." : `Provision New ${role}`}
                </button>
              </form>
            </div>

            {/* Quick Info */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", padding: "25px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#726a63", borderBottom: "1px solid rgba(114,106,99,0.15)", paddingBottom: "12px", marginBottom: "15px" }}>
                Role Context & Rules
              </h3>
              <ul style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.8)", listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "15px" }}>
                <li>
                  <strong style={{ color: "#726a63", display: "block", marginBottom: "3px" }}>Cashier</strong>
                  Operates the Cashier Terminal counter workflow. Logs cash transactions and split push alerts to students.
                </li>
                <li>
                  <strong style={{ color: "#726a63", display: "block", marginBottom: "3px" }}>Serving Staff</strong>
                  Operates the collection counter lookup page. Dispatches student dishes in real-time.
                </li>
                <li>
                  <strong style={{ color: "#726a63", display: "block", marginBottom: "3px" }}>Kitchen Staff</strong>
                  Manages preparation monitor grid and alerts capacity levels.
                </li>
                <li>
                  <strong style={{ color: "#726a63", display: "block", marginBottom: "3px" }}>Administrator</strong>
                  Configures menu publications, handles low stock forecasting updates, and provisions accounts.
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>

      {/* Add/Edit Dish Modal Popup Overlay */}
      {activeMenuIdForDish && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(114, 106, 99, 0.4)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ backgroundColor: "#ffffff", border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "20px", width: "100%", maxWidth: "500px", padding: "30px", boxShadow: "0 15px 45px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: "20px", color: "#726a63", fontFamily: "Libre Franklin" }}>
            
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#726a63", borderBottom: "1px solid rgba(114,106,99,0.1)", paddingBottom: "10px" }}>
              {editingDishId ? "Modify Menu Dish" : "Add Dish to Menu"}
            </h3>

            <form onSubmit={handleSaveDish} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label htmlFor="modalDishNameInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                  Dish Name
                </label>
                <input
                  id="modalDishNameInput"
                  type="text"
                  required
                  placeholder="e.g. Traditional Spicy Pilau"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                />
              </div>

              <div>
                <label htmlFor="modalDishDescInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                  Description
                </label>
                <textarea
                  id="modalDishDescInput"
                  placeholder="Detailed description of the recipe..."
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "15px", fontSize: "12px", outline: "none", backgroundColor: "transparent", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: "15px" }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="modalDishPriceInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                    Price (KES)
                  </label>
                  <input
                    id="modalDishPriceInput"
                    type="number"
                    required
                    min={0}
                    placeholder="250"
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="modalDishPortionsInput" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                    Prepared Portions
                  </label>
                  <input
                    id="modalDishPortionsInput"
                    type="number"
                    required
                    min={0}
                    placeholder="80"
                    value={dishPreparedQty}
                    onChange={(e) => setDishPreparedQty(e.target.value)}
                    style={{ width: "100%", padding: "10px 15px", border: "1px solid rgba(114, 106, 99, 0.3)", borderRadius: "30px", fontSize: "12px", outline: "none", backgroundColor: "transparent" }}
                  />
                </div>
              </div>

              {/* Dietary Selection */}
              <div>
                <label style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                  Dietary Tags
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {DIETARY_TAG_OPTIONS.map((tag) => {
                    const active = dishTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "10px",
                          fontWeight: "700",
                          borderRadius: "15px",
                          border: active ? "1px solid #b7786b" : "1px solid rgba(114, 106, 99, 0.3)",
                          backgroundColor: active ? "rgba(183, 120, 107, 0.08)" : "#ffffff",
                          color: active ? "#b7786b" : "#726a63",
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

              {/* Meal Image Upload Section */}
              <div style={{ border: "1px solid rgba(114, 106, 99, 0.15)", borderRadius: "15px", padding: "12px", backgroundColor: "#faf9f7", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "8px", overflow: "hidden", backgroundColor: "rgba(114,106,99,0.05)", border: "1px solid rgba(114,106,99,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {dishImageUrl ? (
                    <img src={dishImageUrl} alt="Upload preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: "9px", color: "rgba(114,106,99,0.5)", fontStyle: "italic", textAlign: "center" }}>No Image</span>
                  )}
                </div>
                <div style={{ flexGrow: 1 }}>
                  <label htmlFor="modalImageUpload" style={{ display: "block", fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                    Meal Photo
                  </label>
                  <input
                    id="modalImageUpload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleImageUpload(e)}
                    style={{ fontSize: "10px", width: "100%" }}
                  />
                  {uploadingImage && <p style={{ fontSize: "9px", color: "#b7786b", fontWeight: "700", marginTop: "3px", animation: "pulse 1.5s infinite" }}>Uploading file...</p>}
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px", borderTop: "1px solid rgba(114,106,99,0.08)", paddingTop: "15px" }}>
                <button
                  type="button"
                  onClick={closeDishModal}
                  className="slide-btn"
                  style={{ height: "auto", padding: "10px 18px", backgroundColor: "transparent", border: "1px solid rgba(114,106,99,0.3)", color: "#726a63", boxShadow: "none" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="slide-btn"
                  style={{ height: "auto", padding: "10px 22px" }}
                >
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="footer" style={{ marginTop: "auto" }}>
        <p style={{ fontSize: "10px", color: "rgba(114,106,99,0.6)", textAlign: "center" }}>
          © {new Date().getFullYear()} CaféQ. Strathmore University Cafeteria. Kenya Data Protection Act 2019 Compliant.
        </p>
      </footer>

      {/* CSS KEYFRAMES FOR ROTATION */}
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

