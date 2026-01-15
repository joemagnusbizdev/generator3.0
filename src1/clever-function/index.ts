    // ------------------------------------------------------------------------
    // TRENDS — GET ALL
    // ------------------------------------------------------------------------
    if (
      (path === "/trends" || path === "/clever-function/trends") &&
      method === "GET"
    ) {
      const status = url.searchParams.get("status");
      const limit = url.searchParams.get("limit") || "1000";

      let endpoint = `/trends?order=created_at.desc&limit=${limit}`;
      if (status) {
        endpoint = `/trends?status=eq.${status}&order=created_at.desc&limit=${limit}`;
      }

      const trends = await safeQuerySupabaseRest(endpoint);
      return json({ ok: true, trends: trends || [] });
    }

    // ------------------------------------------------------------------------
    // TRENDS — GET ONE
    // ------------------------------------------------------------------------
    if (
      (path.startsWith("/trends/") ||
        path.startsWith("/clever-function/trends/")) &&
      method === "GET"
    ) {
      const id = path.split("/").pop()!;
      const trends = await safeQuerySupabaseRest(`/trends?id=eq.${id}`);

      if (!trends || trends.length === 0) {
        return json({ ok: false, error: "Trend not found" }, 404);
      }

      return json({ ok: true, trend: trends[0] });
    }

    // ------------------------------------------------------------------------
    // TRENDS — CREATE
    // ------------------------------------------------------------------------
    if (
      (path === "/trends" || path === "/clever-function/trends") &&
      method === "POST"
    ) {
      const body = await req.json();

      const created = await safeQuerySupabaseRest(`/trends`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          ...body,
          status: body.status || "open",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      if (!created) {
        return json({ ok: false, error: "Trends table not available" }, 500);
      }

      return json({ ok: true, trend: created[0] });
    }

    // ------------------------------------------------------------------------
    // TRENDS — UPDATE
    // ------------------------------------------------------------------------
    if (
      (path.startsWith("/trends/") ||
        path.startsWith("/clever-function/trends/")) &&
      method === "PATCH"
    ) {
      const id = path.split("/").pop()!;
      const body = await req.json();

      const updated = await safeQuerySupabaseRest(`/trends?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
      });

      return json({ ok: true, trend: updated?.[0] });
    }

    // ------------------------------------------------------------------------
    // TRENDS — DELETE
    // ------------------------------------------------------------------------
    if (
      (path.startsWith("/trends/") ||
        path.startsWith("/clever-function/trends/")) &&
      method === "DELETE"
    ) {
      const id = path.split("/").pop()!;
      await safeQuerySupabaseRest(`/trends?id=eq.${id}`, { method: "DELETE" });
      return json({ ok: true, deleted: id });
    }

    // ------------------------------------------------------------------------
    // 404 — NO MATCHED ROUTE
    // ------------------------------------------------------------------------
    return json({ ok: false, error: "Not found", path }, 404);

  } catch (error: any) {
    console.error("Exception:", error);
    return json(
      {
        ok: false,
        error: error?.message || String(error),
        stack: error?.stack,
      },
      500
    );
  }
});
