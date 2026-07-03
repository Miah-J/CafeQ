import React from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export default function ChartCard({
  title,
  subtitle,
  loading,
  isEmpty = false,
  emptyMessage = "No data available for the selected range.",
  children,
}: ChartCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid rgba(114, 106, 99, 0.15)",
        borderRadius: "20px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "340px",
      }}
    >
      {/* CARD HEADER */}
      <div style={{ marginBottom: "20px" }}>
        <h3
          style={{
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#726a63",
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            style={{
              fontSize: "10px",
              color: "rgba(114, 106, 99, 0.6)",
              marginTop: "4px",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* CARD BODY */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
        {loading ? (
          <div style={{ display: "flex", flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: "220px" }}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  border: "3px solid #b7786b",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 12px",
                }}
              ></div>
              <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.6)" }}>Loading metrics...</p>
            </div>
          </div>
        ) : isEmpty ? (
          <div style={{ display: "flex", flexGrow: 1, alignItems: "center", justifyContent: "center", minHeight: "220px", border: "1px dashed rgba(114, 106, 99, 0.2)", borderRadius: "12px", padding: "20px" }}>
            <p style={{ fontSize: "11px", color: "rgba(114, 106, 99, 0.5)", textAlign: "center" }}>{emptyMessage}</p>
          </div>
        ) : (
          <div style={{ flexGrow: 1, minHeight: "220px", width: "100%" }}>{children}</div>
        )}
      </div>
      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
