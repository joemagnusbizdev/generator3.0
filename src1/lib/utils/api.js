import { getApiUrl } from '../supabase/api';
/**
 * Fetch JSON from API with authentication
 * @param endpoint - The API endpoint path
 * @param token - Authentication token (required)
 * @param options - Additional fetch options
 */
export async function apiFetchJson(endpoint, token, options = {}) {
    const url = getApiUrl(endpoint);
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    // Endpoints that have JWT verification disabled don't need Authorization header
    const noAuthEndpoints = ['/scour-sources-v2', '/scour-early-signals', '/force-stop-scour', '/scour/status', '/cleanup'];
    const needsAuth = !noAuthEndpoints.some(ep => endpoint.includes(ep));
    // Only add Authorization header if token is provided AND endpoint requires auth
    if (token && needsAuth) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    console.log('[apiFetchJson] Request:', { endpoint, url, method: options.method || 'GET', hasToken: !!token, needsAuth });
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('[apiFetchJson] Error response:', { status: response.status, statusText: response.statusText, errorText });
        throw new Error(`API error ${response.status}: ${errorText}`);
    }
    return response.json();
}
/**
 * Delete an alert by ID
 * @param id - Alert ID to delete
 * @param token - Authentication token (required)
 */
export async function deleteAlert(id, token) {
    if (!token) {
        throw new Error('API token required for deleteAlert');
    }
    const url = getApiUrl(`/alerts/${id}`);
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
    const response = await fetch(url, {
        method: 'DELETE',
        headers,
    });
    if (!response.ok) {
        throw new Error(`Failed to delete alert: ${response.statusText}`);
    }
}
/**
 * POST JSON to API
 * Supports both (endpoint, body, token) and (endpoint, token, body?) signatures
 */
export async function apiPostJson(endpoint, bodyOrToken, tokenOrBody) {
    let token;
    let body;
    // Determine which signature is being used
    if (typeof bodyOrToken === 'string') {
        // (endpoint, token, body?) signature
        token = bodyOrToken;
        body = tokenOrBody;
    }
    else {
        // (endpoint, body, token) signature
        body = bodyOrToken;
        token = tokenOrBody;
    }
    console.log('[apiPostJson] Calling with:', { endpoint, hasToken: !!token, hasBody: !!body, bodyType: typeof bodyOrToken });
    return apiFetchJson(endpoint, token, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}
/**
 * PATCH JSON to API
 * Supports both (endpoint, body, token) and (endpoint, token, body?) signatures
 */
export async function apiPatchJson(endpoint, bodyOrToken, tokenOrBody) {
    let token;
    let body;
    // Determine which signature is being used
    if (typeof bodyOrToken === 'string') {
        // (endpoint, token, body?) signature
        token = bodyOrToken;
        body = tokenOrBody;
    }
    else {
        // (endpoint, body, token) signature
        body = bodyOrToken;
        token = tokenOrBody;
    }
    console.log('[apiPatchJson] Calling with:', { endpoint, hasToken: !!token, hasBody: !!body, bodyType: typeof bodyOrToken });
    return apiFetchJson(endpoint, token, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}
/**
 * Bulk upload sources from Excel
 */
export async function bulkUploadSources(sources, token) {
    return apiPostJson('/sources/bulk', { sources }, token);
}
