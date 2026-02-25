/**
 * Lib barrel export
 * Note: Explicit exports to avoid naming conflicts
 */
// Supabase client and config
export { supabase } from './supabase/client';
export { projectId, publicAnonKey, functionName, supabaseUrl } from './supabase/info';
export { getApiUrl } from './supabase/api';
// API utilities (prefer utils/api versions)
export { apiFetchJson, deleteAlert, apiPostJson, apiPatchJson } from './utils/api';
// Permissions
export * from './permissions';
