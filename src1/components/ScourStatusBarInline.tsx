import React, { useEffect, useState } from "react";

const API_BASE =
  "https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function";

export default function ScourStatusBarInline() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch(`${API_BASE}/scour/status`);
      if (res.ok) setStatus(await res.json());
    }, 5000);
    return () => clearInterval(t);
  }, []);

  if (!status?.job) return null;

  return (
    <div className="p-2 bg-gray-100 border rounded text-sm">
      ðŸ” Scour: {status.job.processed}/{status.job.total} processed
    </div>
  );
}



