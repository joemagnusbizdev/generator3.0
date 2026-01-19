/**
 * Permissions System
 * 
 * Role-based access control for the MAGNUS Intelligence Alert Generator
 * 
 * Roles:
 * - operator: Core alert operations - create, scour, review, post, delete, dismiss, trends
 * - analyst: All operator permissions + source management
 * - admin: All permissions including analytics and user management
 */

// ============================================================================
// Types
// ============================================================================

export type Role = 'operator' | 'analyst' | 'admin';

export interface PermissionSet {
  // Alert Management
  canReview: boolean;           // View and review alerts in queue
  canCreate: boolean;           // Create new alerts manually
  canApproveAndPost: boolean;   // Approve alerts and post to WordPress
  canDismiss: boolean;          // Dismiss alerts
  canDelete: boolean;           // Delete alerts
  canEditAlerts: boolean;       // Edit alert details
  
  // Scour System
  canScour: boolean;            // Run scour operations
  canManageSources: boolean;    // Add/edit/delete sources
  canViewScourStats: boolean;   // View scour performance metrics
  
  // Trends
  canViewTrends: boolean;       // View trends
  canCreateTrends: boolean;     // Manually create trends
  canEditTrends: boolean;       // Edit trend details
  canExportTrends: boolean;     // Export trend reports
  canDeleteTrends: boolean;     // Delete trends
  
  // Analytics
  canAccessAnalytics: boolean;  // Access analytics dashboard
  canViewDetailedStats: boolean; // View detailed statistics
  canExportAnalytics: boolean;  // Export analytics data
  
  // User Management (Admin only)
  canManageUsers: boolean;      // Create/edit/delete users
  canViewUsers: boolean;        // View user list
  canChangeRoles: boolean;      // Change user roles
  
  // System Settings (Admin only)
  canAccessSettings: boolean;   // Access system settings
  canConfigureAPI: boolean;     // Configure API settings
  canViewLogs: boolean;         // View system logs
}

// ============================================================================
// Role Definitions
// ============================================================================

/**
 * OPERATOR: Core alert operations
 * - Create, scour, review, post, delete, dismiss alerts
 * - Full trends access
 * - No source management, analytics, or user management
 */
const OPERATOR_PERMISSIONS: PermissionSet = {
  // Alert Management - FULL ACCESS
  canReview: true,
  canCreate: true,
  canApproveAndPost: true,
  canDismiss: true,
  canDelete: true,
  canEditAlerts: true,
  
  // Scour System - Can run scour, but NOT manage sources
  canScour: true,
  canManageSources: false,
  canViewScourStats: true,
  
  // Trends - FULL ACCESS
  canViewTrends: true,
  canCreateTrends: true,
  canEditTrends: true,
  canExportTrends: true,
  canDeleteTrends: true,
  
  // Analytics - NO ACCESS
  canAccessAnalytics: false,
  canViewDetailedStats: false,
  canExportAnalytics: false,
  
  // User Management - NO ACCESS
  canManageUsers: false,
  canViewUsers: false,
  canChangeRoles: false,
  
  // System Settings - NO ACCESS
  canAccessSettings: false,
  canConfigureAPI: false,
  canViewLogs: false,
};

/**
 * ANALYST: All operator permissions + source management
 * - Everything operators can do
 * - Plus: manage sources (add, edit, delete, configure)
 * - No analytics or user management
 */
const ANALYST_PERMISSIONS: PermissionSet = {
  // Alert Management - FULL ACCESS (same as operator)
  canReview: true,
  canCreate: true,
  canApproveAndPost: true,
  canDismiss: true,
  canDelete: true,
  canEditAlerts: true,
  
  // Scour System - FULL ACCESS including source management
  canScour: true,
  canManageSources: true,  // <-- Added for analyst
  canViewScourStats: true,
  
  // Trends - FULL ACCESS (same as operator)
  canViewTrends: true,
  canCreateTrends: true,
  canEditTrends: true,
  canExportTrends: true,
  canDeleteTrends: true,
  
  // Analytics - NO ACCESS
  canAccessAnalytics: false,
  canViewDetailedStats: false,
  canExportAnalytics: false,
  
  // User Management - NO ACCESS
  canManageUsers: false,
  canViewUsers: false,
  canChangeRoles: false,
  
  // System Settings - NO ACCESS
  canAccessSettings: false,
  canConfigureAPI: false,
  canViewLogs: false,
};

/**
 * ADMIN: Full system access
 * - Everything analysts can do
 * - Plus: analytics dashboard
 * - Plus: user management
 * - Plus: system settings
 */
const ADMIN_PERMISSIONS: PermissionSet = {
  // Alert Management - FULL ACCESS
  canReview: true,
  canCreate: true,
  canApproveAndPost: true,
  canDismiss: true,
  canDelete: true,
  canEditAlerts: true,
  
  // Scour System - FULL ACCESS
  canScour: true,
  canManageSources: true,
  canViewScourStats: true,
  
  // Trends - FULL ACCESS
  canViewTrends: true,
  canCreateTrends: true,
  canEditTrends: true,
  canExportTrends: true,
  canDeleteTrends: true,
  
  // Analytics - FULL ACCESS (admin only)
  canAccessAnalytics: true,
  canViewDetailedStats: true,
  canExportAnalytics: true,
  
  // User Management - FULL ACCESS (admin only)
  canManageUsers: true,
  canViewUsers: true,
  canChangeRoles: true,
  
  // System Settings - FULL ACCESS (admin only)
  canAccessSettings: true,
  canConfigureAPI: true,
  canViewLogs: true,
};

// ============================================================================
// Permission Functions
// ============================================================================

/**
 * Get all permissions for a given role
 */
export function getPermissions(role: Role): PermissionSet {
  switch (role) {
    case 'admin':
      return { ...ADMIN_PERMISSIONS };
    case 'analyst':
      return { ...ANALYST_PERMISSIONS };
    case 'operator':
    default:
      return { ...OPERATOR_PERMISSIONS };
  }
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: keyof PermissionSet): boolean {
  const perms = getPermissions(role);
  return perms[permission];
}

/**
 * Normalize role string to valid Role type
 */
export function normalizeRole(raw?: string | null): Role {
  const r = (raw ?? '').toLowerCase().trim();
  if (r === 'admin') return 'admin';
  if (r === 'analyst') return 'analyst';
  return 'operator';
}

/**
 * Get display name for a role
 */
export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    operator: 'Operator',
    analyst: 'Analyst',
    admin: 'Administrator',
  };
  return labels[role] || 'Unknown';
}

/**
 * Get description for a role
 */
export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    operator: 'Core operations: create, scour, review, post, delete, dismiss alerts and manage trends.',
    analyst: 'All operator permissions plus source management (add, edit, delete sources).',
    admin: 'Full system access including analytics dashboard and user management.',
  };
  return descriptions[role] || '';
}

/**
 * Get all available roles (for admin UI)
 */
export function getAllRoles(): { role: Role; label: string; description: string }[] {
  return [
    { role: 'operator', label: getRoleLabel('operator'), description: getRoleDescription('operator') },
    { role: 'analyst', label: getRoleLabel('analyst'), description: getRoleDescription('analyst') },
    { role: 'admin', label: getRoleLabel('admin'), description: getRoleDescription('admin') },
  ];
}

/**
 * Check if a user can perform an action on another user
 */
export function canManageUser(actorRole: Role, targetRole: Role): boolean {
  // Only admins can manage users
  if (actorRole !== 'admin') return false;
  // Admins can manage anyone
  return true;
}

/**
 * Get tabs visible to a role
 */
export function getVisibleTabs(role: Role): string[] {
  const perms = getPermissions(role);
  const tabs: string[] = [];
  
  // Core tabs for all roles (operator+)
  if (perms.canReview) tabs.push('review');
  if (perms.canCreate) tabs.push('create');
  if (perms.canViewTrends) tabs.push('trends');
  
  // Source management (analyst+)
  if (perms.canManageSources) tabs.push('sources');
  
  // Admin-only tabs
  if (perms.canAccessAnalytics) tabs.push('analytics');
  if (perms.canManageUsers) tabs.push('admin');
  
  return tabs;
}

// ============================================================================
// Permission Groups (for UI display)
// ============================================================================

export interface PermissionGroup {
  name: string;
  permissions: { key: keyof PermissionSet; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: 'Alert Management',
    permissions: [
      { key: 'canReview', label: 'Review alerts' },
      { key: 'canCreate', label: 'Create alerts' },
      { key: 'canApproveAndPost', label: 'Approve & post to WordPress' },
      { key: 'canDismiss', label: 'Dismiss alerts' },
      { key: 'canDelete', label: 'Delete alerts' },
      { key: 'canEditAlerts', label: 'Edit alert details' },
    ],
  },
  {
    name: 'Scour System',
    permissions: [
      { key: 'canScour', label: 'Run scour operations' },
      { key: 'canManageSources', label: 'Manage sources' },
      { key: 'canViewScourStats', label: 'View scour statistics' },
    ],
  },
  {
    name: 'Trends',
    permissions: [
      { key: 'canViewTrends', label: 'View trends' },
      { key: 'canCreateTrends', label: 'Create trends' },
      { key: 'canEditTrends', label: 'Edit trends' },
      { key: 'canExportTrends', label: 'Export trend reports' },
      { key: 'canDeleteTrends', label: 'Delete trends' },
    ],
  },
  {
    name: 'Analytics',
    permissions: [
      { key: 'canAccessAnalytics', label: 'Access analytics' },
      { key: 'canViewDetailedStats', label: 'View detailed statistics' },
      { key: 'canExportAnalytics', label: 'Export analytics data' },
    ],
  },
  {
    name: 'User Management',
    permissions: [
      { key: 'canManageUsers', label: 'Manage users' },
      { key: 'canViewUsers', label: 'View user list' },
      { key: 'canChangeRoles', label: 'Change user roles' },
    ],
  },
  {
    name: 'System Settings',
    permissions: [
      { key: 'canAccessSettings', label: 'Access system settings' },
      { key: 'canConfigureAPI', label: 'Configure API settings' },
      { key: 'canViewLogs', label: 'View system logs' },
    ],
  },
];

// ============================================================================
// Export convenience type for components
// ============================================================================

export type { PermissionSet as Permissions };





