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
// Role Definitions
// ============================================================================
/**
 * OPERATOR: Core alert operations
 * - Create, scour, review, post, delete, dismiss alerts
 * - Full trends access
 * - No source management, analytics, or user management
 */
const OPERATOR_PERMISSIONS = {
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
const ANALYST_PERMISSIONS = {
    // Alert Management - FULL ACCESS (same as operator)
    canReview: true,
    canCreate: true,
    canApproveAndPost: true,
    canDismiss: true,
    canDelete: true,
    canEditAlerts: true,
    // Scour System - FULL ACCESS including source management
    canScour: true,
    canManageSources: true, // <-- Added for analyst
    canViewScourStats: true,
    // Trends - FULL ACCESS (same as operator)
    canViewTrends: true,
    canCreateTrends: true,
    canEditTrends: true,
    canExportTrends: true,
    canDeleteTrends: true,
    // Analytics - FULL ACCESS (analyst+ can access analytics)
    canAccessAnalytics: true,
    canViewDetailedStats: true,
    canExportAnalytics: true,
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
const ADMIN_PERMISSIONS = {
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
export function getPermissions(role) {
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
export function hasPermission(role, permission) {
    const perms = getPermissions(role);
    return perms[permission];
}
/**
 * Normalize role string to valid Role type
 */
export function normalizeRole(raw) {
    const r = (raw ?? '').toLowerCase().trim();
    if (r === 'admin')
        return 'admin';
    if (r === 'analyst')
        return 'analyst';
    return 'operator';
}
/**
 * Get display name for a role
 */
export function getRoleLabel(role) {
    const labels = {
        operator: 'Operator',
        analyst: 'Analyst',
        admin: 'Administrator',
    };
    return labels[role] || 'Unknown';
}
/**
 * Get description for a role
 */
export function getRoleDescription(role) {
    const descriptions = {
        operator: 'Core operations: create, scour, review, post, delete, dismiss alerts and manage trends.',
        analyst: 'All operator permissions plus source management and analytics dashboard.',
        admin: 'Full system access including user management and system settings.',
    };
    return descriptions[role] || '';
}
/**
 * Get all available roles (for admin UI)
 */
export function getAllRoles() {
    return [
        { role: 'operator', label: getRoleLabel('operator'), description: getRoleDescription('operator') },
        { role: 'analyst', label: getRoleLabel('analyst'), description: getRoleDescription('analyst') },
        { role: 'admin', label: getRoleLabel('admin'), description: getRoleDescription('admin') },
    ];
}
/**
 * Check if a user can perform an action on another user
 */
export function canManageUser(actorRole, targetRole) {
    // Only admins can manage users
    if (actorRole !== 'admin')
        return false;
    // Admins can manage anyone
    return true;
}
/**
 * Get tabs visible to a role
 */
export function getVisibleTabs(role) {
    const perms = getPermissions(role);
    const tabs = [];
    // Core tabs for all roles (operator+)
    if (perms.canReview)
        tabs.push('review');
    if (perms.canCreate)
        tabs.push('create');
    if (perms.canViewTrends)
        tabs.push('trends');
    // Source management (analyst+)
    if (perms.canManageSources)
        tabs.push('sources');
    // Admin-only tabs
    if (perms.canAccessAnalytics)
        tabs.push('analytics');
    if (perms.canManageUsers)
        tabs.push('admin');
    return tabs;
}
export const PERMISSION_GROUPS = [
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
