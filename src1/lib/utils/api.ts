import { getApiUrl } from '../supabase/api';

/**
 * Fetch JSON from API with authentication
 * @param endpoint - The API endpoint path
 * @param token - Authentication token (required)
 * @param options - Additional fetch options
 */
export async function apiFetchJson<T>(
  endpoint: string,
  token?: string,
  options: RequestInit = {}
): Promise<T> {
  if (!token) {
    throw new Error('API token required for apiFetchJson');
  }

  const url = getApiUrl(endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Delete an alert by ID
 * @param id - Alert ID to delete
 * @param token - Authentication token (required)
 */
export async function deleteAlert(id: string, token?: string): Promise<void> {
  if (!token) {
    throw new Error('API token required for deleteAlert');
  }

  const url = getApiUrl(`/alerts/${id}`);
  const headers: Record<string, string> = {
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
 */
export async function apiPostJson<T>(
  endpoint: string,
  body: any,
  token?: string
): Promise<T> {
  return apiFetchJson<T>(endpoint, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH JSON to API
 */
export async function apiPatchJson<T>(
  endpoint: string,
  body: any,
  token?: string
): Promise<T> {
  return apiFetchJson<T>(endpoint, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Bulk upload sources from Excel
 */
export async function bulkUploadSources(sources: any[], token?: string): Promise<any> {
  return apiPostJson('/sources/bulk', { sources }, token);
}




