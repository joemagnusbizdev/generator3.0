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
import { buttonVariants, cardVariants, formControls } from '../styles/designSystem';

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
    color: colors.grayscale[700],
    bgColor: colors.grayscale[200],
  },
  analyst: {
    label: 'Analyst',
    description: 'All operator permissions plus source management.',
    color: colors.blue[700],
    bgColor: colors.blue[100],
  },
  admin: {
    label: 'Administrator',
    description: 'Full access including analytics and user management.',
    color: colors.purple[700],
    bgColor: colors.purple[100],
  },
};

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
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.grayscale[500] }}>
        <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>🔒 Access Restricted</p>
        <p>Only administrators can manage users.</p>
      </div>
    );
  }

  // Fetch users
  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const data = await apiFetchJson<User[]>('/admin/users', accessToken);
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load users';
      setErr(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reset form
  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'operator' });
    setFormError(null);
    setShowAddForm(false);
    setEditingUser(null);
  };

  // Start editing user
  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email,
      password: '', // Don't pre-fill password
      role: user.role,
    });
    setFormError(null);
    setShowAddForm(false);
  };

  // Handle create user
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }

    if (!formData.email.trim()) {
      setFormError('Email is required');
      return;
    }

    if (!formData.password || formData.password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);

    try {
      const result = await apiPostJson<{ ok: boolean; error?: string }>('/admin/users', formData, accessToken);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to create user');
      }
      resetForm();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle update user
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(null);

    const updates: any = {};

    // Only include changed fields
    if (formData.name.trim() !== (editingUser.name || '')) {
      updates.name = formData.name.trim();
    }
    if (formData.role !== editingUser.role) {
      updates.role = formData.role;
    }
    if (formData.password && formData.password.length > 0) {
      if (formData.password.length < 8) {
        setFormError('Password must be at least 8 characters');
        return;
      }
      updates.password = formData.password;
    }

    if (Object.keys(updates).length === 0) {
      setFormError('No changes to save');
      return;
    }

    setSubmitting(true);

    try {
      const result = await apiPatchJson<{ ok: boolean; error?: string }>(
        `/admin/users/${editingUser.id}`,
        updates,
        accessToken
      );
      if (!result.ok) {
        throw new Error(result.error || 'Failed to update user');
      }
      resetForm();
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete user
  const deleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete ${user.name || user.email}?`)) return;

    setBusyId(user.id);

    try {
      await apiFetchJson(`/admin/users/${user.id}`, accessToken, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== user.id));
      if (editingUser?.id === user.id) {
        resetForm();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete user';
      alert(message);
    } finally {
      setBusyId(null);
    }
  };

  // Quick role change
  const changeRole = async (user: User, newRole: Role) => {
    if (user.role === newRole) return;
    
    setBusyId(user.id);

    try {
      const result = await apiPatchJson<{ ok: boolean; error?: string }>(
        `/admin/users/${user.id}`,
        { role: newRole },
        accessToken
      );
      if (!result.ok) {
        throw new Error(result.error || 'Failed to update role');
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role';
      alert(message);
    } finally {
      setBusyId(null);
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    padding: '1.5rem',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
  };

  const formCardStyle: React.CSSProperties = {
    ...cardVariants.base,
    padding: '1.5rem',
    marginBottom: '1.5rem',
    backgroundColor: editingUser ? colors.yellow[50] : colors.blue[50],
    border: `1px solid ${editingUser ? colors.yellow[200] : colors.blue[200]}`,
  };

  const inputGroupStyle: React.CSSProperties = {
    marginBottom: '1rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: colors.grayscale[700],
  };

  const inputStyle: React.CSSProperties = {
    ...formControls.input,
    width: '100%',
  };

  const userCardStyle: React.CSSProperties = {
    ...cardVariants.base,
    padding: '1rem',
    marginBottom: '0.75rem',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '1rem',
    alignItems: 'center',
  };

  const roleBadgeStyle = (role: Role): React.CSSProperties => ({
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    backgroundColor: ROLE_INFO[role].bgColor,
    color: ROLE_INFO[role].color,
  });

  const errorStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    backgroundColor: colors.red[50],
    border: `1px solid ${colors.red[200]}`,
    borderRadius: '8px',
    color: colors.red[700],
    marginBottom: '1rem',
    fontSize: '0.875rem',
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 600, 
            color: colors.magnusDarkGreen,
            margin: 0,
            marginBottom: '0.25rem',
          }}>
            👥 User Management
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: colors.grayscale[500] }}>
            {users.length} user{users.length !== 1 ? 's' : ''} • Only admins can create users
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!showAddForm && !editingUser && (
            <button
              onClick={() => { setShowAddForm(true); setEditingUser(null); }}
              style={buttonVariants.primary}
            >
              + Add User
            </button>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            style={buttonVariants.secondary}
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {err && <div style={errorStyle}><strong>Error:</strong> {err}</div>}

      {/* Add/Edit Form */}
      {(showAddForm || editingUser) && (
        <div style={formCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: editingUser ? colors.yellow[700] : colors.blue[700] }}>
              {editingUser ? `Edit: ${editingUser.name || editingUser.email}` : 'Add New User'}
            </h3>
            <button onClick={resetForm} style={{ ...buttonVariants.secondary, ...buttonVariants.small }}>
              Cancel
            </button>
          </div>

          {formError && <div style={errorStyle}>{formError}</div>}

          <form onSubmit={editingUser ? handleUpdate : handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="Full name"
                  required={!editingUser}
                />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Email {!editingUser && '*'}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  style={{ ...inputStyle, backgroundColor: editingUser ? colors.grayscale[100] : 'white' }}
                  placeholder="user@company.com"
                  required={!editingUser}
                  disabled={!!editingUser} // Can't change email
                />
                {editingUser && (
                  <p style={{ fontSize: '0.7rem', color: colors.grayscale[500], marginTop: '0.25rem' }}>
                    Email cannot be changed
                  </p>
                )}
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Password {!editingUser && '*'}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  style={inputStyle}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Minimum 8 characters'}
                  minLength={editingUser ? 0 : 8}
                  required={!editingUser}
                />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Role *</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as Role }))}
                  style={{ ...formControls.select, width: '100%' }}
                >
                  {(['operator', 'analyst', 'admin'] as Role[]).map(role => (
                    <option key={role} value={role}>
                      {ROLE_INFO[role].label}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '0.7rem', color: colors.grayscale[500], marginTop: '0.25rem' }}>
                  {ROLE_INFO[formData.role].description}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{ ...buttonVariants.primary, marginTop: '0.5rem' }}
            >
              {submitting ? (editingUser ? 'Saving...' : 'Creating...') : (editingUser ? 'Save Changes' : 'Create User')}
            </button>
          </form>
        </div>
      )}

      {/* Role Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: colors.grayscale[50],
        borderRadius: '8px',
      }}>
        {(['operator', 'analyst', 'admin'] as Role[]).map(role => (
          <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={roleBadgeStyle(role)}>{ROLE_INFO[role].label}</span>
            <span style={{ fontSize: '0.75rem', color: colors.grayscale[600] }}>
              {ROLE_INFO[role].description}
            </span>
          </div>
        ))}
      </div>

      {/* Users List */}
      {loading && users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: colors.grayscale[500] }}>
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: colors.grayscale[500] }}>
          No users found. Click "Add User" to create one.
        </div>
      ) : (
        <div>
          {users.map(user => {
            const isBusy = busyId === user.id;
            const isEditing = editingUser?.id === user.id;

            return (
              <div
                key={user.id}
                style={{
                  ...userCardStyle,
                  opacity: isBusy ? 0.6 : 1,
                  borderColor: isEditing ? colors.yellow[300] : colors.grayscale[200],
                  backgroundColor: isEditing ? colors.yellow[50] : 'white',
                }}
              >
                {/* User Info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '1rem', color: colors.magnusDarkText }}>
                      {user.name || 'Unnamed User'}
                    </strong>
                    <span style={roleBadgeStyle(user.role)}>
                      {ROLE_INFO[user.role].label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: colors.grayscale[600], marginBottom: '0.25rem' }}>
                    {user.email}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: colors.grayscale[500] }}>
                    Created: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    {' • '}
                    Last login: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  {/* Quick Role Change */}
                  <select
                    value={user.role}
                    onChange={e => changeRole(user, e.target.value as Role)}
                    disabled={isBusy}
                    style={{
                      ...formControls.select,
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      width: 'auto',
                    }}
                  >
                    {(['operator', 'analyst', 'admin'] as Role[]).map(role => (
                      <option key={role} value={role}>{ROLE_INFO[role].label}</option>
                    ))}
                  </select>

                  {/* Edit/Delete Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => startEdit(user)}
                      disabled={isBusy}
                      style={{ ...buttonVariants.secondary, ...buttonVariants.small }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteUser(user)}
                      disabled={isBusy}
                      style={{ ...buttonVariants.danger, ...buttonVariants.small }}
                    >
                      {isBusy ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default UserManagementInline;
