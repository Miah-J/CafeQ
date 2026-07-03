"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  UtensilsCrossed,
  TrendingUp,
  Award,
  UserPlus,
  Download,
  RefreshCw,
  Calendar,
  AlertCircle
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
  FunnelChart,
  Funnel,
  LabelList
} from "recharts";

import KpiCard from "@/components/admin/KpiCard";
import ChartCard from "@/components/admin/ChartCard";

// Colors matches Strathmore CafeQ branding tokens in globals.css
const COLOR_PRIMARY = "#b7786b"; // Terracotta
const COLOR_SECONDARY = "#726a63"; // Warm Taupe
const COLOR_ACCENT = "#636e52"; // Olive Green
const COLOR_HIGHLIGHT = "#C48000"; // Low-stock Amber
const COLOR_ALERT = "#DC2626"; // Sold-out Red

const PIE_COLORS = [COLOR_PRIMARY, COLOR_SECONDARY, COLOR_ACCENT, COLOR_HIGHLIGHT, COLOR_ALERT];

export default function AdminAnalytics() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Academic Calendar Events State
  const [academicEvents, setAcademicEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventType, setNewEventType] = useState("EXAM_WEEK");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [submittingEvent, setSubmittingEvent] = useState(false);

  // Filters
  const [dateOption, setDateOption] = useState<"today" | "7d" | "30d" | "custom">("7d");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");

  // Dashboard Data
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Role Guard verification
  useEffect(() => {
    const userStr = sessionStorage.getItem("user");
    const token = sessionStorage.getItem("token");
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
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  // Fetch Dashboard Analytics Data
  const fetchDashboardData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    const token = sessionStorage.getItem("token");
    try {
      const params = new URLSearchParams({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate + "T23:59:59.999Z").toISOString(),
        granularity,
      });

      const res = await fetch(`http://localhost:3001/analytics/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load analytics statistics.");
      }

      const responseData = await res.json();
      setData(responseData);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademicEvents = async () => {
    if (!isAdmin) return;
    setLoadingEvents(true);
    const token = sessionStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:3001/analytics/academic-events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAcademicEvents(data);
      }
    } catch (err) {
      console.error("Failed to fetch academic events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleCreateAcademicEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName || !newEventStart || !newEventEnd) return;
    setSubmittingEvent(true);
    setError("");
    setSuccess("");
    const token = sessionStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:3001/analytics/academic-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newEventName,
          eventType: newEventType,
          startDate: newEventStart,
          endDate: newEventEnd,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to create academic event.");
      }
      setSuccess("Academic event created successfully!");
      setNewEventName("");
      setNewEventStart("");
      setNewEventEnd("");
      void fetchAcademicEvents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingEvent(false);
    }
  };

  const handleDeleteAcademicEvent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this academic event?")) return;
    setError("");
    setSuccess("");
    const token = sessionStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:3001/analytics/academic-events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to delete academic event.");
      }
      setSuccess("Academic event deleted successfully!");
      void fetchAcademicEvents();
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void fetchDashboardData();
      void fetchAcademicEvents();
    }
  }, [isAdmin, startDate, endDate, granularity]);

  const handleDateOptionChange = (option: "today" | "7d" | "30d" | "custom") => {
    setDateOption(option);
    const end = new Date();
    const start = new Date();

    if (option === "today") {
      setStartDate(end.toISOString().split("T")[0]);
      setEndDate(end.toISOString().split("T")[0]);
    } else if (option === "7d") {
      start.setDate(end.getDate() - 7);
      setStartDate(start.toISOString().split("T")[0]);
      setEndDate(end.toISOString().split("T")[0]);
    } else if (option === "30d") {
      start.setDate(end.getDate() - 30);
      setStartDate(start.toISOString().split("T")[0]);
      setEndDate(end.toISOString().split("T")[0]);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    router.push("/login");
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setError("");
    setSuccess("");
    const token = sessionStorage.getItem("token");
    try {
      const params = new URLSearchParams({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate + "T23:59:59.999Z").toISOString(),
      });

      const res = await fetch(`http://localhost:3001/analytics/export-csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cafeq_analytics_report_${startDate}_to_${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccess("Report CSV downloaded successfully.");
      } else {
        throw new Error("Failed to export analytics report CSV.");
      }
    } catch (err: any) {
      setError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  // Helper values for empty state verification
  const isKpiLoading = loading || !data?.kpi;
  const isOverviewEmpty = !data?.overview || data.overview.length === 0;
  const isHourlyEmpty = !data?.hourly || data.hourly.length === 0;
  const isTopDishesEmpty = !data?.menu?.topDishes || data.menu.topDishes.length === 0;
  const isBottomDishesEmpty = !data?.menu?.bottomDishes || data.menu.bottomDishes.length === 0;
  const isCategoryEmpty = !data?.menu?.categoryShare || data.menu.categoryShare.length === 0;
  const isPaymentSplitEmpty = !data?.payment?.mpesaSplit || data.payment.mpesaSplit.length === 0;
  const isFailureReasonsEmpty = !data?.payment?.failureReasons || data.payment.failureReasons.length === 0;
  const isPickupRateEmpty = !data?.fulfillment?.pickupRate || data.fulfillment.pickupRate.length === 0;
  const isFulfillmentTrendEmpty = !data?.fulfillment?.prepTimeTrend || data.fulfillment.prepTimeTrend.length === 0;
  const isUserSplitEmpty = !data?.behavior?.userSplit || data.behavior.userSplit.length === 0;
  const isFunnelEmpty = !data?.behavior?.funnel || data.behavior.funnel.every((f: any) => f.value === 0);
  const isInventoryEmpty = !data?.inventory || data.inventory.length === 0;

  // Custom Heatmap Grid processing
  // Generates 24 hours (rows) x 7 days of week (cols: Sun-Sat)
  const daysOfWeekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatmapGrid: number[][] = Array(24).fill(0).map(() => Array(7).fill(0));
  let maxHeatmapCount = 1;

  if (data?.hourly) {
    data.hourly.forEach((item: any) => {
      const day = item.dayOfWeek;
      const hr = item.hour;
      if (day >= 0 && day < 7 && hr >= 0 && hr < 24) {
        heatmapGrid[hr][day] = item.orderCount;
        if (item.orderCount > maxHeatmapCount) {
          maxHeatmapCount = item.orderCount;
        }
      }
    });
  }

  if (!isAdmin || !isMounted) {
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
      
      {/* HEADER */}
      <header className="header-wrapper" style={{ borderBottom: "1px solid rgba(114, 106, 99, 0.12)" }}>
        <div className="header-top" style={{ padding: "15px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="logo" style={{ fontSize: "18px", fontWeight: "950", color: "#b7786b", letterSpacing: "0.05em" }}>CAFÉQ</span>
            <span style={{ height: "16px", width: "1px", backgroundColor: "rgba(114, 106, 99, 0.2)", margin: "0 10px" }}></span>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.6)" }}>
              Admin Console
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
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

      <div style={{ display: "flex", flexGrow: 1, minHeight: "calc(100vh - 120px)" }}>
        
        {/* Sticky Left Sidebar Console */}
        <aside style={{ width: "260px", backgroundColor: "#ffffff", borderRight: "1px solid rgba(114, 106, 99, 0.12)", padding: "35px 24px", display: "flex", flexDirection: "column", gap: "25px", flexShrink: 0 }}>
          <div style={{ marginBottom: "5px" }}>
            <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(114, 106, 99, 0.4)" }}>Admin Navigation</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link href="/admin?tab=overview" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 15px", fontSize: "11px", fontWeight: "700", color: "#726a63", textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: "6px" }}>
              <LayoutDashboard size={15} strokeWidth={2.2} />
              <span>Overview</span>
            </Link>
            <Link href="/admin?tab=menus" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 15px", fontSize: "11px", fontWeight: "700", color: "#726a63", textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: "6px" }}>
              <UtensilsCrossed size={15} strokeWidth={2.2} />
              <span>Menu Manager</span>
            </Link>
            <span style={{ background: "rgba(183, 120, 107, 0.08)", borderLeft: "3px solid #b7786b", padding: "12px 15px", fontSize: "11px", fontWeight: "700", color: "#b7786b", textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: "0 6px 6px 0", display: "flex", alignItems: "center", gap: "10px", cursor: "default" }}>
              <TrendingUp size={15} strokeWidth={2.2} />
              <span>Analytics</span>
            </span>
            <Link href="/admin?tab=reports" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 15px", fontSize: "11px", fontWeight: "700", color: "#726a63", textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: "6px" }}>
              <TrendingUp size={15} strokeWidth={2.2} />
              <span>Reports</span>
            </Link>
            <Link href="/admin?tab=loyalty" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 15px", fontSize: "11px", fontWeight: "700", color: "#726a63", textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: "6px" }}>
              <Award size={15} strokeWidth={2.2} />
              <span>Loyalty Program</span>
            </Link>
            <Link href="/admin?tab=staff" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 15px", fontSize: "11px", fontWeight: "700", color: "#726a63", textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: "6px" }}>
              <UserPlus size={15} strokeWidth={2.2} />
              <span>Provision Staff</span>
            </Link>
          </div>
        </aside>

        {/* MAIN WORKSPACE */}
        <main style={{ flexGrow: 1, padding: "40px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "30px" }}>
          
          {/* Messages Alerts */}
          {error && (
            <div style={{ backgroundColor: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "10px", color: "#DC2626", padding: "12px 20px", fontSize: "12px", fontWeight: "700", textAlign: "center" }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "10px", color: "#10B981", padding: "12px 20px", fontSize: "12px", fontWeight: "700", textAlign: "center" }}>
              {success}
            </div>
          )}

          {/* PAGE HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "20px" }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "28px", fontWeight: 700, color: "#726a63" }}>
                Admin Analytics
              </h1>
              <p style={{ fontSize: "13px", color: "rgba(114, 106, 99, 0.7)", marginTop: "4px" }}>
                Strathmore University CaféQ operational performance & financial metrics.
              </p>
            </div>
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid rgba(114, 106, 99, 0.2)",
                borderRadius: "30px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: "700",
                color: "#726a63",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh Stats</span>
            </button>
          </div>

          {/* 1. KPI CARDS ROW (Live stats for Today) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
            <KpiCard
              title="Today's Revenue"
              value={`KES ${(data?.kpi?.todayRevenue || 0).toLocaleString()}`}
              subtitle="Confirmed M-Pesa / Wallet sales"
              loading={isKpiLoading}
            />
            <KpiCard
              title="Today's Orders"
              value={data?.kpi?.todayOrders || 0}
              subtitle="Total active pre-orders placed"
              loading={isKpiLoading}
            />
            <KpiCard
              title="Active Users (24h)"
              value={data?.kpi?.activeUsers24h || 0}
              subtitle="Distinct customers ordering"
              loading={isKpiLoading}
            />
            <KpiCard
              title="M-Pesa Success Rate"
              value={`${data?.kpi?.mpesaSuccessRate || 0}%`}
              subtitle="Daraja callback success split"
              loading={isKpiLoading}
            />
          </div>

          {/* 2. GLOBAL CONTROLS */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid rgba(114, 106, 99, 0.15)",
              borderRadius: "20px",
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px"
            }}
          >
            {/* Filter buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {(["today", "7d", "30d", "custom"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleDateOptionChange(opt)}
                  style={{
                    backgroundColor: dateOption === opt ? "rgba(183, 120, 107, 0.1)" : "transparent",
                    border: dateOption === opt ? "1px solid #b7786b" : "1px solid rgba(114, 106, 99, 0.2)",
                    borderRadius: "30px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: dateOption === opt ? "#b7786b" : "#726a63",
                    cursor: "pointer",
                    textTransform: "capitalize"
                  }}
                >
                  {opt === "7d" ? "Last 7 Days" : opt === "30d" ? "Last 30 Days" : opt}
                </button>
              ))}

              {dateOption === "custom" && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "10px" }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      border: "1px solid rgba(114, 106, 99, 0.3)",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontFamily: "inherit",
                      color: "#726a63"
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#726a63" }}>to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      border: "1px solid rgba(114, 106, 99, 0.3)",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontFamily: "inherit",
                      color: "#726a63"
                    }}
                  />
                </div>
              )}
            </div>

            {/* CSV export button */}
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              style={{
                backgroundColor: "#b7786b",
                border: "none",
                borderRadius: "30px",
                padding: "10px 20px",
                fontSize: "12px",
                fontWeight: "700",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: exporting ? "not-allowed" : "pointer",
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => { if (!exporting) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { if (!exporting) e.currentTarget.style.opacity = "1"; }}
            >
              <Download size={14} />
              <span>{exporting ? "Exporting..." : "Export Filtered CSV"}</span>
            </button>
          </div>

          {/* 3. ORDER & REVENUE OVERVIEW */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "25px" }}>
            <ChartCard
              title="Revenue & Order Volume"
              subtitle="Line chart tracking total sales revenue (KES) and volume over time"
              loading={loading}
              isEmpty={isOverviewEmpty}
            >
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "15px", gap: "8px" }}>
                {(["daily", "weekly", "monthly"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    style={{
                      backgroundColor: granularity === g ? "rgba(114, 106, 99, 0.1)" : "transparent",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "#726a63",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data?.overview} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(114, 106, 99, 0.1)" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                    }}
                    stroke="rgba(114, 106, 99, 0.5)"
                    style={{ fontSize: "10px" }}
                  />
                  <YAxis yAxisId="left" stroke={COLOR_PRIMARY} style={{ fontSize: "10px" }} />
                  <YAxis yAxisId="right" orientation="right" stroke={COLOR_SECONDARY} style={{ fontSize: "10px" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid rgba(114, 106, 99, 0.15)", fontSize: "11px" }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (KES)" stroke={COLOR_PRIMARY} strokeWidth={2.5} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="orderCount" name="Orders Count" stroke={COLOR_SECONDARY} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Hourly Order Density"
              subtitle="Heatmap of order volume by Hour of Day (Rows) x Day of Week (Columns)"
              loading={loading}
              isEmpty={isHourlyEmpty}
            >
              <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                <div style={{ display: "grid", gridTemplateColumns: "40px repeat(7, 1fr)", gap: "4px", marginBottom: "8px" }}>
                  {/* Day labels top header */}
                  <div></div>
                  {daysOfWeekLabels.map((day) => (
                    <div key={day} style={{ textAlign: "center", fontSize: "10px", fontWeight: "700", color: "rgba(114, 106, 99, 0.7)", textTransform: "uppercase" }}>
                      {day}
                    </div>
                  ))}

                  {/* Heatmap grid cells */}
                  {Array.from({ length: 15 }).map((_, hourIdx) => {
                    const hour = hourIdx + 7; // Displaying operational school hours (7 AM to 9 PM)
                    const displayHour = `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? "PM" : "AM"}`;
                    return (
                      <React.Fragment key={hour}>
                        {/* Hour Label */}
                        <div style={{ fontSize: "9px", display: "flex", alignItems: "center", color: "rgba(114, 106, 99, 0.6)" }}>
                          {displayHour}
                        </div>
                        {/* Grid Columns */}
                        {Array.from({ length: 7 }).map((_, dayIdx) => {
                          const count = heatmapGrid[hour]?.[dayIdx] || 0;
                          const ratio = count / maxHeatmapCount;
                          const opacity = count > 0 ? 0.12 + ratio * 0.88 : 0.03;
                          const bgColor = count > 0 ? COLOR_PRIMARY : "rgba(114, 106, 99, 1)";
                          return (
                            <div
                              key={dayIdx}
                              title={`${daysOfWeekLabels[dayIdx]} ${displayHour}: ${count} orders`}
                              style={{
                                height: "15px",
                                backgroundColor: bgColor,
                                opacity: opacity,
                                borderRadius: "3px",
                                cursor: "pointer",
                                transition: "transform 0.1s"
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.15)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", fontSize: "9px", color: "rgba(114, 106, 99, 0.6)" }}>
                  <span>Less orders</span>
                  <div style={{ display: "flex", gap: "2px" }}>
                    {[0.1, 0.3, 0.5, 0.7, 1.0].map((o) => (
                      <div key={o} style={{ width: "10px", height: "10px", backgroundColor: COLOR_PRIMARY, opacity: o, borderRadius: "2px" }} />
                    ))}
                  </div>
                  <span>More orders</span>
                </div>
              </div>
            </ChartCard>
          </div>

          {/* 4. MENU PERFORMANCE */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "25px", minWidth: "0" }}>
            <ChartCard
              title="Dish Sales Popularity (Top 5 vs Bottom 5)"
              subtitle="Horizontal bar comparison of best-selling and worst-selling menu items"
              loading={loading}
              isEmpty={isTopDishesEmpty && isBottomDishesEmpty}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <h4 style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: COLOR_ACCENT, marginBottom: "10px", textAlign: "center" }}>
                    Top 5 Best Sellers
                  </h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data?.menu?.topDishes} layout="vertical" margin={{ left: 30, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(114, 106, 99, 0.1)" />
                      <XAxis type="number" stroke="rgba(114, 106, 99, 0.5)" style={{ fontSize: "9px" }} />
                      <YAxis dataKey="name" type="category" stroke="rgba(114, 106, 99, 0.7)" width={70} style={{ fontSize: "9px", fontWeight: "600" }} />
                      <Tooltip contentStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="quantitySold" fill={COLOR_ACCENT} radius={[0, 4, 4, 0]} name="Qty Sold" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h4 style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: COLOR_ALERT, marginBottom: "10px", textAlign: "center" }}>
                    Bottom 5 Slow Sellers
                  </h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data?.menu?.bottomDishes} layout="vertical" margin={{ left: 30, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(114, 106, 99, 0.1)" />
                      <XAxis type="number" stroke="rgba(114, 106, 99, 0.5)" style={{ fontSize: "9px" }} />
                      <YAxis dataKey="name" type="category" stroke="rgba(114, 106, 99, 0.7)" width={70} style={{ fontSize: "9px", fontWeight: "600" }} />
                      <Tooltip contentStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="quantitySold" fill={COLOR_ALERT} radius={[0, 4, 4, 0]} name="Qty Sold" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </ChartCard>

            <ChartCard
              title="Revenue Share by Category"
              subtitle="Percentage split of revenue between main meals, beverages, and snacks"
              loading={loading}
              isEmpty={isCategoryEmpty}
            >
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data?.menu?.categoryShare}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data?.menu?.categoryShare?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `KES ${Number(value).toLocaleString()}`} contentStyle={{ fontSize: "11px" }} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* 5. PAYMENT & TRANSACTION HEALTH */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "25px", minWidth: "0" }}>
            <ChartCard
              title="M-Pesa Checkout Split"
              subtitle="M-Pesa payment outcomes split"
              loading={loading}
              isEmpty={isPaymentSplitEmpty}
            >
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data?.payment?.mpesaSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data?.payment?.mpesaSplit?.map((entry: any, index: number) => {
                      let color = COLOR_SECONDARY;
                      if (entry.name === "COMPLETED") color = COLOR_ACCENT;
                      if (entry.name === "FAILED") color = COLOR_ALERT;
                      if (entry.name === "PENDING") color = COLOR_HIGHLIGHT;
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: "11px" }} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Daraja Error Breakdown"
              subtitle="Categorised causes of transaction failures"
              loading={loading}
              isEmpty={isFailureReasonsEmpty}
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.payment?.failureReasons}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(114, 106, 99, 0.1)" />
                  <XAxis dataKey="name" stroke="rgba(114, 106, 99, 0.5)" style={{ fontSize: "10px" }} />
                  <YAxis stroke="rgba(114, 106, 99, 0.5)" style={{ fontSize: "10px" }} />
                  <Tooltip contentStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="value" name="Failures" fill={COLOR_PRIMARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(114, 106, 99, 0.15)",
                  borderRadius: "20px",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  flexGrow: 1,
                  minHeight: "340px"
                }}
              >
                <div>
                  <h3 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "#726a63", marginBottom: "15px" }}>
                    Payment Confirmation Velocity
                  </h3>
                  <p style={{ fontSize: "10px", color: "rgba(114, 106, 99, 0.6)" }}>
                    Average duration from when a student initiates check-out until callback completion.
                  </p>
                </div>
                
                <div style={{ textAlign: "center", margin: "40px 0" }}>
                  <span style={{ fontSize: "44px", fontWeight: "950", color: "#b7786b", display: "block" }}>
                    {loading ? "..." : `${data?.payment?.avgConfirmationTimeSeconds || 0}s`}
                  </span>
                  <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: COLOR_ACCENT, marginTop: "8px", display: "inline-block", backgroundColor: "rgba(99, 110, 82, 0.08)", padding: "4px 8px", borderRadius: "10px" }}>
                    Daraja Callback Speed
                  </span>
                </div>

                <div style={{ fontSize: "10px", color: "rgba(114, 106, 99, 0.5)", borderTop: "1px solid rgba(114, 106, 99, 0.1)", paddingTop: "15px" }}>
                  Includes STK push response delay and network carrier roundtrip.
                </div>
              </div>
            </div>
          </div>

          {/* 6. PICKUP & FULFILLMENT */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "25px", minWidth: "0" }}>
            <ChartCard
              title="Portion Collection Rates"
              subtitle="Picked up portions vs no-show rates (orders uncollected > 24 hours)"
              loading={loading}
              isEmpty={isPickupRateEmpty}
            >
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data?.fulfillment?.pickupRate}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data?.fulfillment?.pickupRate?.map((entry: any, index: number) => {
                      let color = COLOR_SECONDARY;
                      if (entry.name === "Picked Up") color = COLOR_ACCENT;
                      if (entry.name === "No-Show") color = COLOR_ALERT;
                      if (entry.name === "Pending Pickup") color = COLOR_HIGHLIGHT;
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: "11px" }} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Daily Kitchen Prep vs Collection Wait Time"
              subtitle="Average portion prep time (kitchen ready) vs customer wait time (pickup completion) in minutes"
              loading={loading}
              isEmpty={isFulfillmentTrendEmpty}
            >
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data?.fulfillment?.prepTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(114, 106, 99, 0.1)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                    }}
                    stroke="rgba(114, 106, 99, 0.5)"
                    style={{ fontSize: "10px" }}
                  />
                  <YAxis label={{ value: "Minutes", angle: -90, position: "insideLeft", style: { fontSize: "10px", fill: "rgba(114, 106, 99, 0.6)" } }} stroke="rgba(114, 106, 99, 0.5)" style={{ fontSize: "10px" }} />
                  <Tooltip contentStyle={{ fontSize: "11px" }} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Line type="monotone" dataKey="avgPrepTime" name="Prep Time (Min)" stroke={COLOR_PRIMARY} strokeWidth={2} />
                  {/* Align wait time series by matching date key */}
                  <Line type="monotone" data={data?.fulfillment?.waitTimeTrend} dataKey="avgWaitTime" name="Customer Wait Time (Min)" stroke={COLOR_ACCENT} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* 7. USER BEHAVIOR */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "25px", minWidth: "0" }}>
            <ChartCard
              title="Customer Cohorts"
              subtitle="New (first order in filter range) vs Returning customer split"
              loading={loading}
              isEmpty={isUserSplitEmpty}
            >
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data?.behavior?.userSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data?.behavior?.userSplit?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: "11px" }} />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Check-Out Conversion Funnel"
              subtitle="Customer progression from menu browsing to checkout completion"
              loading={loading}
              isEmpty={isFunnelEmpty}
            >
              <ResponsiveContainer width="100%" height={220}>
                <FunnelChart>
                  <Tooltip formatter={(value) => `${value} events`} contentStyle={{ fontSize: "11px" }} />
                  <Funnel
                    dataKey="value"
                    data={data?.behavior?.funnel}
                    isAnimationActive
                  >
                    <LabelList position="right" fill="#726a63" stroke="none" dataKey="stage" style={{ fontSize: "10px", fontWeight: "700" }} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* 8. INVENTORY/WASTE SECTION */}
          <ChartCard
            title="Daily Production vs Consumer Demand (Waste Tracking)"
            subtitle="Quantity of meals prepared vs meals sold per menu day"
            loading={loading}
            isEmpty={isInventoryEmpty}
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.inventory} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(114, 106, 99, 0.1)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  }}
                  stroke="rgba(114, 106, 99, 0.5)"
                  style={{ fontSize: "10px" }}
                />
                <YAxis label={{ value: "Portions", angle: -90, position: "insideLeft", style: { fontSize: "10px", fill: "rgba(114, 106, 99, 0.6)" } }} stroke="rgba(114, 106, 99, 0.5)" style={{ fontSize: "10px" }} />
                <Tooltip contentStyle={{ fontSize: "11px" }} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar dataKey="prepared" name="Portions Prepared" fill={COLOR_PRIMARY} radius={[4, 4, 0, 0]} />
                <Bar dataKey="sold" name="Portions Sold" fill={COLOR_ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* 9. ACADEMIC CALENDAR CORRELATION AND MANAGEMENT */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "25px", alignItems: "start" }}>
            
            {/* Chart Card Column */}
            <div style={{ minWidth: "0" }}>
              <ChartCard
                title="Academic Calendar Correlation Analysis"
                subtitle="Sales volume trend highlighted with Strathmore exam weeks and semester break intervals"
                loading={loading}
                isEmpty={isOverviewEmpty}
              >
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data?.overview} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(114, 106, 99, 0.1)" />
                    
                    {/* Render dynamic shaded bands from backend database */}
                    {data?.overview && data.overview.length > 0 && academicEvents.map((event, idx) => {
                      const matchingPeriods = data.overview.filter((item: any) => {
                        const itemDate = new Date(item.period);
                        const sDate = new Date(event.startDate + "T00:00:00");
                        const eDate = new Date(event.endDate + "T23:59:59");
                        return itemDate >= sDate && itemDate <= eDate;
                      });

                      if (matchingPeriods.length === 0) return null;

                      const x1 = matchingPeriods[0].period;
                      const x2 = matchingPeriods[matchingPeriods.length - 1].period;

                      return (
                        <ReferenceArea
                          key={event.id || idx}
                          x1={x1}
                          x2={x2}
                          fill={event.eventType === "EXAM_WEEK" ? "rgba(220, 38, 38, 0.05)" : "rgba(99, 110, 82, 0.05)"}
                          stroke={event.eventType === "EXAM_WEEK" ? "rgba(220, 38, 38, 0.2)" : "rgba(99, 110, 82, 0.2)"}
                          strokeDasharray="3 3"
                        />
                      );
                    })}

                    <XAxis
                      dataKey="period"
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                      }}
                      stroke="rgba(114, 106, 99, 0.5)"
                      style={{ fontSize: "10px" }}
                    />
                    <YAxis label={{ value: "Orders Count", angle: -90, position: "insideLeft", style: { fontSize: "10px", fill: "rgba(114, 106, 99, 0.6)" } }} stroke="rgba(114, 106, 99, 0.5)" style={{ fontSize: "10px" }} />
                    <Tooltip
                      contentStyle={{ fontSize: "11px" }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    />
                    <Line type="monotone" dataKey="orderCount" name="Orders Count" stroke={COLOR_PRIMARY} strokeWidth={2.5} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "10px", fontSize: "10px", color: "rgba(114, 106, 99, 0.6)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "16px", height: "10px", backgroundColor: "rgba(220, 38, 38, 0.05)", border: "1px dashed rgba(220, 38, 38, 0.3)", borderRadius: "2px" }} />
                    <span>Exam Week (Decreased Order volume expected)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "16px", height: "10px", backgroundColor: "rgba(99, 110, 82, 0.05)", border: "1px dashed rgba(99, 110, 82, 0.3)", borderRadius: "2px" }} />
                    <span>Semester Break (Low/No order activity)</span>
                  </div>
                </div>
              </ChartCard>
            </div>

            {/* Management Form Column */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid rgba(114, 106, 99, 0.15)",
                borderRadius: "20px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                minHeight: "340px"
              }}
            >
              <h3 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", color: "#726a63", marginBottom: "15px" }}>
                Manage Calendar Events
              </h3>

              {/* Add event form */}
              <form onSubmit={handleCreateAcademicEvent} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", borderBottom: "1px solid rgba(114, 106, 99, 0.1)", paddingBottom: "15px" }}>
                <div>
                  <label style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "rgba(114, 106, 99, 0.6)", display: "block", marginBottom: "4px" }}>
                    Event Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mid-Semester Break"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    required
                    style={{ width: "100%", border: "1px solid rgba(114, 106, 99, 0.25)", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", fontFamily: "inherit", color: "#726a63" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "rgba(114, 106, 99, 0.6)", display: "block", marginBottom: "4px" }}>
                    Event Type
                  </label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value)}
                    style={{ width: "100%", border: "1px solid rgba(114, 106, 99, 0.25)", borderRadius: "6px", padding: "6px 10px", fontSize: "11px", fontFamily: "inherit", color: "#726a63" }}
                  >
                    <option value="EXAM_WEEK">Exam Week</option>
                    <option value="SEMESTER_BREAK">Semester Break</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "rgba(114, 106, 99, 0.6)", display: "block", marginBottom: "4px" }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newEventStart}
                      onChange={(e) => setNewEventStart(e.target.value)}
                      required
                      style={{ width: "100%", border: "1px solid rgba(114, 106, 99, 0.25)", borderRadius: "6px", padding: "6px 8px", fontSize: "10px", fontFamily: "inherit", color: "#726a63" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "rgba(114, 106, 99, 0.6)", display: "block", marginBottom: "4px" }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      value={newEventEnd}
                      onChange={(e) => setNewEventEnd(e.target.value)}
                      required
                      style={{ width: "100%", border: "1px solid rgba(114, 106, 99, 0.25)", borderRadius: "6px", padding: "6px 8px", fontSize: "10px", fontFamily: "inherit", color: "#726a63" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingEvent}
                  style={{
                    marginTop: "5px",
                    backgroundColor: "#b7786b",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#ffffff",
                    cursor: submittingEvent ? "not-allowed" : "pointer"
                  }}
                >
                  {submittingEvent ? "Saving..." : "Add Event Range"}
                </button>
              </form>

              {/* Event list */}
              <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minHeight: "140px" }}>
                <h4 style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", color: "rgba(114, 106, 99, 0.5)", marginBottom: "8px" }}>
                  Saved Date Ranges
                </h4>
                <div style={{ overflowY: "auto", flexGrow: 1, maxHeight: "160px", paddingRight: "4px" }}>
                  {loadingEvents ? (
                    <p style={{ fontSize: "10px", color: "rgba(114, 106, 99, 0.5)" }}>Loading saved events...</p>
                  ) : academicEvents.length === 0 ? (
                    <p style={{ fontSize: "10px", color: "rgba(114, 106, 99, 0.5)", fontStyle: "italic" }}>No custom calendar ranges added yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {academicEvents.map((evt) => (
                        <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(114, 106, 99, 0.12)", borderRadius: "6px", padding: "6px 10px", backgroundColor: "#f8f7f6" }}>
                          <div style={{ minWidth: 0, paddingRight: "8px" }}>
                            <span style={{ fontSize: "10px", fontWeight: "700", color: "#726a63", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evt.name}</span>
                            <span style={{ fontSize: "8px", color: "rgba(114, 106, 99, 0.6)", display: "block" }}>
                              {evt.startDate} to {evt.endDate} ({evt.eventType === "EXAM_WEEK" ? "Exam" : "Break"})
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteAcademicEvent(evt.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: COLOR_ALERT,
                              fontSize: "14px",
                              fontWeight: "700",
                              cursor: "pointer",
                              padding: "2px 6px",
                              lineHeight: 1
                            }}
                            title="Delete event range"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

        </main>
      </div>
    </div>
  );
}
