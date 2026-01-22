/**
 * UserManagementInline - Admin user management component
 * 
 * Users are stored in Supabase Auth with:
 * - email: login email
 * - user_metadata.name: display name
 * - user_metadata.role: 'operator' | 'analyst' | 'admin'
 * 
 * Only admins can access this component
 */
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetchJson, apiPostJson, apiPatchJson } from '../lib/utils/api';
import { colors } from '../styles/inline';
import MAGNUS_COLORS from '../styles/magnus-colors';

// ============================================================================
// Types
// ============================================================================

type Role = 'operator' | 'analyst' | 'admin';

interface User {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  created_at?: string;
  last_sign_in_at?: string;
}

interface UserManagementInlineProps {
  accessToken?: string;
  currentUserRole: Role;
  permissions: {
    canManageUsers?: boolean;
    canViewUsers?: boolean;
    canChangeRoles?: boolean;
  };
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_INFO: Record<Role, { label: string; description: string; color: string; bgColor: string }> = {
  operator: {
    label: 'Operator',
    description: 'Create, review, approve, post, delete, dismiss alerts. Full trend access.',
    color: MAGNUS_COLORS.deepGreen,
    bgColor: MAGNUS_COLORS.offWhite,
  },
  analyst: {
    label: 'Analyst',
    description: 'All operator permissions plus source management.',
    color: MAGNUS_COLORS.darkGreen,
    bgColor: MAGNUS_COLORS.offWhite,
  },
  admin: {
    label: 'Administrator',
    description: 'Full access including analytics and user management.',
    color: MAGNUS_COLORS.orange,
    bgColor: MAGNUS_COLORS.offWhite,
  },
};

const ALLOWED_DOMAIN = '@magnus.co.il';

// ============================================================================
// Component
// ============================================================================

export function UserManagementInline({
  accessToken,
  currentUserRole,
  permissions,
}: UserManagementInlineProps): JSX.Element | null {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator' as Role,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Permission check
  if (!permissions.canManageUsers || currentUserRole !== 'admin') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.gray500 }}>
        <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}> Access Restricted</p>
        <p>Only administrators can manage users.</p>
      </div>
    );
  }

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetchJson<{ ok: boolean; users?: User[]; error?: string }>(
        '/admin/users',
        accessToken
      );
      if (res.ok && res.users) {
        setUsers(res.users);
      } else {
        setErr(res.error || 'Failed to load users');
        setUsers([]);
      }
    } catch (e) {
      setErr('Network error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'operator' });
    setFormError(null);
    setEditingUser(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!accessToken) {
      console.error('[UserManagement] No access token available');
      setFormError('Authentication required. Please log in again.');
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Email is required');
      return;
    }
    if (!formData.email.endsWith(ALLOWED_DOMAIN)) {
      setFormError(`Email must be from ${ALLOWED_DOMAIN} domain`);
      return;
    }
    if (!editingUser && formData.password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = editingUser ? `/admin/users/${editingUser.id}` : '/admin/users';
      const payload = editingUser
        ? { name: formData.name, role: formData.role }
        : { name: formData.name, email: formData.email, password: formData.password, role: formData.role };

      console.log('[UserManagement] Creating/updating user:', { 
        endpoint, 
        payload, 
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length 
      });

      // Call API directly with explicit parameters instead of variable method reference
      const res = editingUser
        ? await apiPatchJson<{ ok: boolean; error?: string }>(endpoint, payload, accessToken)
        : await apiPostJson<{ ok: boolean; error?: string }>(endpoint, payload, accessToken);

      if (res.ok) {
        resetForm();
        refresh();
      } else {
        const errorMsg = res.error || 'Failed to create user';
        console.error('[UserManagement] API error:', errorMsg);
        setFormError(errorMsg);
      }
    } catch (e: any) {
      const errorMsg = e?.message || 'Network error';
      console.error('[UserManagement] Network error:', e);
      setFormError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setBusyId(userId);
    try {
      const res = await apiPatchJson<{ ok: boolean; error?: string }>(
        `/admin/users/${userId}`,
        { role: newRole },
        accessToken
      );

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      } else {
        setErr(res.error || 'Failed to update role');
      }
    } catch (e) {
      setErr('Network error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    setBusyId(userId);
    try {
      const res = await apiFetchJson<{ ok: boolean; error?: string }>(
        `/admin/users/${userId}`,
        accessToken,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        setErr(res.error || 'Failed to delete user');
      }
    } catch (e) {
      setErr('Network error');
    } finally {
      setBusyId(null);
    }
  };

  // ============================================================================
  // Styles
  // ============================================================================

  const containerStyle: React.CSSProperties = {
    padding: '1.5rem',
    backgroundColor: MAGNUS_COLORS.offWhite,
    minHeight: '100%',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: MAGNUS_COLORS.darkGreen,
    margin: 0,
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.2s',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: MAGNUS_COLORS.deepGreen,
    color: '#fff',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: MAGNUS_COLORS.offWhite,
    color: MAGNUS_COLORS.darkGreen,
    border: `1px solid ${MAGNUS_COLORS.deepGreen}`,
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: MAGNUS_COLORS.critical,
    color: '#fff',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '0.75rem',
    border: `1px solid ${MAGNUS_COLORS.border}`,
    marginBottom: '1.5rem',
    overflow: 'hidden',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    borderRadius: '0.5rem',
    border: `1px solid ${MAGNUS_COLORS.border}`,
    fontSize: '0.875rem',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: MAGNUS_COLORS.darkGreen,
    marginBottom: '0.375rem',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    backgroundColor: MAGNUS_COLORS.offWhite,
    fontSize: '0.75rem',
    fontWeight: '700',
    color: MAGNUS_COLORS.darkGreen,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: `1px solid ${MAGNUS_COLORS.border}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    borderBottom: `1px solid ${MAGNUS_COLORS.divider}`,
    fontSize: '0.875rem',
    color: MAGNUS_COLORS.secondaryText,
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={titleStyle}> User Management</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            style={secondaryButtonStyle}
            onClick={refresh}
            disabled={loading}
          >
             Refresh
          </button>
          <button
            style={primaryButtonStyle}
            onClick={() => setShowAddForm(true)}
          >
             Add User
          </button>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: MAGNUS_COLORS.offWhite,
            border: `1px solid ${MAGNUS_COLORS.critical}`,
            borderRadius: '0.5rem',
            color: MAGNUS_COLORS.critical,
            marginBottom: '1rem',
          }}
        >
          {err}
        </div>
      )}

      {/* Add User Form */}
      {showAddForm && (
        <div style={cardStyle}>
          <div style={{ padding: '1rem', borderBottom: `1px solid ${MAGNUS_COLORS.border}`, backgroundColor: MAGNUS_COLORS.offWhite }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: MAGNUS_COLORS.darkGreen }}>
              Add New User
            </h3>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  style={inputStyle}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={`user${ALLOWED_DOMAIN}`}
                />
              </div>
              <div>
                <label style={labelStyle}>Password *</label>
                <input
                  type="password"
                  style={inputStyle}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <label style={labelStyle}>Role *</label>
                <select
                  style={inputStyle}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                >
                  {Object.entries(ROLE_INFO).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <div style={{ marginTop: '1rem', color: colors.red600, fontSize: '0.875rem' }}>
                 {formError}
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" style={secondaryButtonStyle} onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" style={primaryButtonStyle} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div style={cardStyle}>
        <div style={{ padding: '1rem', borderBottom: `1px solid ${colors.gray200}`, backgroundColor: colors.gray50 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.gray800 }}>
            Users ({users.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.gray500 }}>
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: colors.gray500 }}>
            No users found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Created</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ opacity: busyId === user.id ? 0.5 : 1 }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '600', color: colors.gray800 }}>
                        {user.name || 'No name'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: colors.gray500 }}>
                        {user.email}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        disabled={busyId === user.id}
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.375rem',
                          border: `1px solid ${colors.gray300}`,
                          backgroundColor: ROLE_INFO[user.role]?.bgColor || colors.gray100,
                          color: ROLE_INFO[user.role]?.color || colors.gray700,
                          fontWeight: '600',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        {Object.entries(ROLE_INFO).map(([key, info]) => (
                          <option key={key} value={key}>
                            {info.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        style={{
                          ...dangerButtonStyle,
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                        }}
                        onClick={() => handleDelete(user.id)}
                        disabled={busyId === user.id}
                      >
                         Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Descriptions */}
      <div style={cardStyle}>
        <div style={{ padding: '1rem', borderBottom: `1px solid ${colors.gray200}`, backgroundColor: colors.gray50 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.gray800 }}>
            Role Descriptions
          </h3>
        </div>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            {Object.entries(ROLE_INFO).map(([key, info]) => (
              <div
                key={key}
                style={{
                  padding: '1rem',
                  backgroundColor: info.bgColor,
                  borderRadius: '0.5rem',
                  border: `1px solid ${info.color}20`,
                }}
              >
                <div style={{ fontWeight: '700', color: info.color, marginBottom: '0.25rem' }}>
                  {info.label}
                </div>
                <div style={{ fontSize: '0.8125rem', color: colors.gray600 }}>
                  {info.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserManagementInline;





