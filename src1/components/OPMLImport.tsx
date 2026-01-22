import React, { useState } from "react";
import { getApiUrl } from "../lib/supabase/api";
import MAGNUS_COLORS from "../styles/magnus-colors";

interface OPMLImportProps {
  accessToken: string;
  onImportComplete?: () => void;
}

export const OPMLImport: React.FC<OPMLImportProps> = ({ accessToken, onImportComplete }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const url = getApiUrl("/integrations/opml/import");
      console.log("[OPMLImport] Posting to:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      console.log("OPML Import Response Status:", response.status);
      console.log("OPML Import Response Headers:", response.headers);

      if (!response.ok) {
        const text = await response.text();
        console.error("OPML Import Error Response:", text);
        setError(`Import failed (${response.status}): ${text.substring(0, 100)}`);
        return;
      }

      const text = await response.text();
      console.log("OPML Import Response Text:", text);

      if (!text) {
        setError("Empty response from server");
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error("JSON Parse Error:", parseErr, "Text:", text);
        setError(`Invalid JSON response: ${text.substring(0, 100)}`);
        return;
      }

      if (!data.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
        if (onImportComplete) {
          onImportComplete();
        }
      }
    } catch (err: any) {
      console.error("OPML Import Catch Error:", err);
      setError(err.message || "Failed to import OPML");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="p-4 rounded border"
      style={{ backgroundColor: MAGNUS_COLORS.offWhite, borderColor: MAGNUS_COLORS.border }}
    >
      <h3 className="font-semibold mb-3" style={{ color: MAGNUS_COLORS.darkGreen }}>
        📥 Import OPML (Feedly, rss.app, etc.)
      </h3>

      {/* File Input */}
      <div className="mb-3">
        <label
          className="block w-full p-4 border-2 border-dashed rounded cursor-pointer text-center transition"
          style={{
            borderColor: loading ? MAGNUS_COLORS.secondaryText : MAGNUS_COLORS.deepGreen,
            backgroundColor: loading ? MAGNUS_COLORS.offWhite : "white",
          }}
        >
          <input
            type="file"
            accept=".opml,.xml"
            onChange={handleFileSelect}
            disabled={loading}
            className="hidden"
          />
          <div style={{ color: MAGNUS_COLORS.secondaryText }}>
            {loading ? (
              <>
                <div className="text-sm font-semibold">Processing…</div>
                <div className="text-xs mt-1">Validating feeds and checking reachability</div>
              </>
            ) : fileName ? (
              <>
                <div className="font-semibold">{fileName}</div>
                <div className="text-xs mt-1" style={{ color: MAGNUS_COLORS.secondaryText }}>
                  Click to select a different file
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold">Drop OPML file here or click to select</div>
                <div className="text-xs mt-1" style={{ color: MAGNUS_COLORS.tertiaryText }}>
                  Supported: .opml, .xml from Feedly, rss.app, or any RSS aggregator
                </div>
              </>
            )}
          </div>
        </label>
      </div>

      {/* Results */}
      {error && (
        <div
          className="p-3 rounded mb-3 text-sm"
          style={{ backgroundColor: MAGNUS_COLORS.critical, color: "white" }}
        >
          ❌ {error}
        </div>
      )}

      {result && (
        <div
          className="p-3 rounded space-y-2 text-sm"
          style={{ backgroundColor: MAGNUS_COLORS.caution, color: "white" }}
        >
          <div>
            ✅ <strong>Import Complete</strong>
          </div>
          <div>
            • <strong>{result.imported}</strong> new feeds imported
            {result.duplicates > 0 && ` · ${result.duplicates} duplicates skipped`}
          </div>
          {result.unreachable > 0 && (
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.3)" }}>
              <div className="text-xs opacity-90">
                ⚠️ {result.unreachable} feeds were unreachable and skipped:
              </div>
              {result.unreachableExamples?.map((ex: any, i: number) => (
                <div key={i} className="text-xs mt-1 opacity-75">
                  • {ex.title || ex.url}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Helper Text */}
      <div className="mt-3 text-xs" style={{ color: MAGNUS_COLORS.tertiaryText }}>
        💡 <strong>How to export OPML:</strong>
        <ul className="ml-4 mt-1 space-y-1">
          <li>• <strong>Feedly:</strong> Settings → Feeds & Collections → Export</li>
          <li>• <strong>rss.app:</strong> Settings → Export Subscriptions</li>
          <li>• <strong>Other readers:</strong> Look for "Export" or "Backup" option</li>
        </ul>
      </div>
    </div>
  );
};

export default OPMLImport;
