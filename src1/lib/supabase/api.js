import { projectId, functionName } from "./info";
/**
 * Constructs the full API URL for a given endpoint
 * @param endpoint - The endpoint path (e.g., "/alerts", "/sources")
 * @returns Full URL to the Supabase Edge Function endpoint
 */
export function getApiUrl(endpoint) {
    if (!projectId) {
        console.error("Cannot construct API URL: missing VITE_SUPABASE_PROJECT_ID");
        return "";
    }
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const base = `https://${projectId}.supabase.co/functions/v1/${functionName}`;
    return endpoint ? `${base}${path}` : base;
}
/**
 * Fetch JSON from the API with authentication
 */
export async function apiFetchJson(endpoint, token) {
    const url = getApiUrl(endpoint);
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
    }
    return await res.json();
}
/**
 * POST to the API with authentication
 */
export async function apiPost(endpoint, token, body) {
    const url = getApiUrl(endpoint);
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
    }
    return await res.json();
}
/**
 * PATCH to the API with authentication
 */
export async function apiPatch(endpoint, token, body) {
    const url = getApiUrl(endpoint);
    const res = await fetch(url, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
    }
    return await res.json();
}
/**
 * DELETE from the API with authentication
 */
export async function apiDelete(endpoint, token) {
    const url = getApiUrl(endpoint);
    const res = await fetch(url, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
    }
    return await res.json();
}
