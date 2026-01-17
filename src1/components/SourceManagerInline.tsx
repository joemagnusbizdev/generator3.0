import React, { useState, useEffect } from "react";
import { apiFetchJson } from "../lib/utils/api";
import { useScour } from "./ScourContext";
import { SourceBulkUpload } from "./SourceBulkUpload";
import ScourStatusBarInline from "./ScourStatusBarInline";
import { SourceTable } from "./SourceTable";
import { AutoScourSettings } from "./AutoScourSettings";

/* =========================
   Types
========================= */

interface Source {
  id: string;
  name: string;
  url: string;
  country?: string;
  enabled: boolean;
  created_at: string;
}

interface SourceManagerInlineProps {
  accessToken: string;
  permissions?: {
    canManageSources?: boolean;
    canScour?: boolean;
  };
}

/* =========================
   Component
========================= */

const SourceManagerInline: React.FC<SourceManagerInlineProps> = ({
  accessToken,
  permissions,
}) => {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isScouring, startScour } = useScour();

  const canManage = permissions?.canManageSources !== false;
  const canScour = permissions?.canScour !== false;
  const isAdmin = canManage;

  /* =========================
     Data loading
  ========================= */

  const loadSources = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetchJson<{
        ok: boolean;
        sources: Source[];
      }>("/sources", accessToken);

      if (response.ok && Array.isArray(response.sources)) {
        setSources(response.sources);
        console.log(`Loaded ${response.sources.length} sources`);
      } else {
        setSources([]);
      }
    } catch (err: any) {
      console.error("Failed to load sources:", err);
      setError(err?.message || "Failed to load sources");
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, [accessToken]);

  /* =========================
     Scour
  ========================= */

  const handleStartScour = async () => {
    if (!canScour) {
      alert("You do not have permission to run scour operations.");
      return;
    }

    const enabledSources = sources.filter((s) => s.enabled);

    const filteredSources = enabledSources.filter((s) =>
      [s.name, s.country]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
    );

    if (filteredSources.length === 0) {
      alert("No enabled sources match the current filter.");
      return;
    }

    try {
      await startScour(accessToken, {
        sourceIds: filteredSources.map((s) => s.id),
        daysBack: 14,
      });
    } catch (err: any) {
      console.error("Start scour error:", err);
      alert(`Failed to start scour: ${err.message}`);
    }
  };

  /* =========================
     Styles
  ========================= */

  const containerStyle: React.CSSProperties = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "12px",
    color: "#111827",
  };

  const buttonPrimaryStyle: React.CSSProperties = {
    padding: "10px 20px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "10px 20px",
    background: "white",
    color: "#374151",
    border: "1px solid #D1D5DB",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  };

  /* =========================
     Render
  ========================= */

  return (
    <div style={containerStyle}>
      {/* Auto Scour Settings */}
      {isAdmin && (
        <AutoScourSettings accessToken={accessToken} isAdmin={isAdmin} />
      )}

      {/* Bulk Upload */}
      {canManage && (
        <>
          <h2 style={headingStyle}>Bulk Upload Sources</h2>
          <SourceBulkUpload
            accessToken={accessToken}
            onUploadComplete={loadSources}
          />
        </>
      )}

      {/* Scour Status */}
      <ScourStatusBarInline />

      {/* Controls */}
      <div
        style={{
          marginBottom: "16px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <button
          onClick={handleStartScour}
          disabled={isScouring || !canScour}
          style={{
            ...buttonPrimaryStyle,
            opacity: isScouring || !canScour ? 0.5 : 1,
          }}
        >
          {isScouring ? "Scouring..." : "Start Scour"}
        </button>

        <button
          onClick={loadSources}
          disabled={loading}
          style={{ ...buttonStyle, opacity: loading ? 0.5 : 1 }}
        >
          Refresh Sources
        </button>

        {sources.length > 0 && (
          <span style={{ fontSize: "14px", color: "#6B7280" }}>
            {sources.filter((s) => s.enabled).length} of {sources.length} enabled
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: "#991B1B", marginBottom: "12px" }}>{error}</div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center" }}>
          Loading sources...
        </div>
      ) : (
        <>
          <h2 style={headingStyle}>Sources ({sources.length})</h2>

          {sources.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6B7280" }}>
              No sources configured
            </div>
          ) : (
            <SourceTable
              sources={sources}
              onSourceUpdated={loadSources}
              accessToken={accessToken}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SourceManagerInline;

