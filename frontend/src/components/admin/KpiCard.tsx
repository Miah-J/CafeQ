import React from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
}

export default function KpiCard({ title, value, subtitle, loading }: KpiCardProps) {
  if (loading) {
    return (
      <div 
        style={{ 
          backgroundColor: "#ffffff", 
          border: "1px solid rgba(114, 106, 99, 0.15)", 
          borderRadius: "20px", 
          padding: "20px", 
          display: "flex", 
          flexDirection: "column", 
          justifyContent: "space-between",
          height: "100%",
          minHeight: "110px"
        }}
        className="animate-pulse"
      >
        <div style={{ height: "10px", width: "40%", backgroundColor: "rgba(114, 106, 99, 0.15)", borderRadius: "4px" }}></div>
        <div style={{ height: "24px", width: "75%", backgroundColor: "rgba(114, 106, 99, 0.15)", borderRadius: "4px", marginTop: "12px" }}></div>
        <div style={{ height: "8px", width: "50%", backgroundColor: "rgba(114, 106, 99, 0.15)", borderRadius: "4px", marginTop: "10px" }}></div>
      </div>
    );
  }

  return (
    <div 
      style={{ 
        backgroundColor: "#ffffff", 
        border: "1px solid rgba(114, 106, 99, 0.15)", 
        borderRadius: "20px", 
        padding: "20px", 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "space-between",
        height: "100%",
        minHeight: "110px"
      }}
    >
      <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(114, 106, 99, 0.5)" }}>
        {title}
      </span>
      <span style={{ fontSize: "24px", fontWeight: "950", color: "#b7786b", marginTop: "10px", fontFamily: "var(--font-sans), sans-serif" }}>
        {value}
      </span>
      {subtitle && (
        <span style={{ fontSize: "9px", color: "rgba(114, 106, 99, 0.6)", marginTop: "5px" }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
