/**
 * API utility functions for the MAGNUS frontend
 */

import { getApiUrl } from '../supabase/api';

/**
 * Generic JSON fetch with authentication
 */
export async function apiFetchJson<T = unknown>(
  endpoint: string,
  token?: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(endpoint);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Delete an alert by ID
 */
export async function deleteAlert(id: string, token: string): Promise<void> {
  const url = getApiUrl(`/alerts/${id}`);
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete alert: ${response.statusText}`);
  }
}

/**
 * POST JSON to an endpoint
 */
export async function apiPostJson<T = unknown>(
  endpoint: string,
  body: unknown,
  token?: string
): Promise<T> {
  return apiFetchJson<T>(endpoint, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH JSON to an endpoint
 */
export async function apiPatchJson<T = unknown>(
  endpoint: string,
  body: unknown,
  token?: string
): Promise<T> {
  return apiFetchJson<T>(endpoint, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
