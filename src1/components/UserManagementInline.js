import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useState, useEffect, useCallback } from 'react';
import { apiFetchJson, apiPostJson, apiPatchJson } from '../lib/utils/api';
import { colors } from '../styles/inline';
import MAGNUS_COLORS from '../styles/magnus-colors';
// ============================================================================
// Constants
// ============================================================================
const ROLE_INFO = {
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
export function UserManagementInline({ accessToken, currentUserRole, permissions, }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);
    const [busyId, setBusyId] = useState(null);
    // Form states
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'operator',
    });
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    // Permission check
    if (!permissions.canManageUsers || currentUserRole !== 'admin') {
        return (_jsxs("div", { style: { padding: '2rem', textAlign: 'center', color: colors.gray500 }, children: [_jsx("p", { style: { fontSize: '1.125rem', marginBottom: '0.5rem' }, children: " Access Restricted" }), _jsx("p", { children: "Only administrators can manage users." })] }));
    }
    // ============================================================================
    // Data Fetching
    // ============================================================================
    const refresh = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const res = await apiFetchJson('/admin/users', accessToken);
            if (res.ok && res.users) {
                setUsers(res.users);
            }
            else {
                setErr(res.error || 'Failed to load users');
                setUsers([]);
            }
        }
        catch (e) {
            setErr('Network error');
            setUsers([]);
        }
        finally {
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
    const handleSubmit = async (e) => {
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
                ? await apiPatchJson(endpoint, payload, accessToken)
                : await apiPostJson(endpoint, payload, accessToken);
            if (res.ok) {
                resetForm();
                refresh();
            }
            else {
                const errorMsg = res.error || 'Failed to create user';
                console.error('[UserManagement] API error:', errorMsg);
                setFormError(errorMsg);
            }
        }
        catch (e) {
            const errorMsg = e?.message || 'Network error';
            console.error('[UserManagement] Network error:', e);
            setFormError(errorMsg);
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleRoleChange = async (userId, newRole) => {
        setBusyId(userId);
        try {
            const res = await apiPatchJson(`/admin/users/${userId}`, { role: newRole }, accessToken);
            if (res.ok) {
                setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
            }
            else {
                setErr(res.error || 'Failed to update role');
            }
        }
        catch (e) {
            setErr('Network error');
        }
        finally {
            setBusyId(null);
        }
    };
    const handleDelete = async (userId) => {
        if (!confirm('Are you sure you want to delete this user?'))
            return;
        setBusyId(userId);
        try {
            const res = await apiFetchJson(`/admin/users/${userId}`, accessToken, { method: 'DELETE' });
            if (res.ok) {
                setUsers((prev) => prev.filter((u) => u.id !== userId));
            }
            else {
                setErr(res.error || 'Failed to delete user');
            }
        }
        catch (e) {
            setErr('Network error');
        }
        finally {
            setBusyId(null);
        }
    };
    // ============================================================================
    // Styles
    // ============================================================================
    const containerStyle = {
        padding: '1.5rem',
        backgroundColor: MAGNUS_COLORS.offWhite,
        minHeight: '100%',
    };
    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
    };
    const titleStyle = {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: MAGNUS_COLORS.darkGreen,
        margin: 0,
    };
    const buttonStyle = {
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: '600',
        transition: 'all 0.2s',
    };
    const primaryButtonStyle = {
        ...buttonStyle,
        backgroundColor: MAGNUS_COLORS.deepGreen,
        color: '#fff',
    };
    const secondaryButtonStyle = {
        ...buttonStyle,
        backgroundColor: MAGNUS_COLORS.offWhite,
        color: MAGNUS_COLORS.darkGreen,
        border: `1px solid ${MAGNUS_COLORS.deepGreen}`,
    };
    const dangerButtonStyle = {
        ...buttonStyle,
        backgroundColor: MAGNUS_COLORS.critical,
        color: '#fff',
    };
    const cardStyle = {
        backgroundColor: '#fff',
        borderRadius: '0.75rem',
        border: `1px solid ${MAGNUS_COLORS.border}`,
        marginBottom: '1.5rem',
        overflow: 'hidden',
    };
    const inputStyle = {
        width: '100%',
        padding: '0.625rem 0.875rem',
        borderRadius: '0.5rem',
        border: `1px solid ${MAGNUS_COLORS.border}`,
        fontSize: '0.875rem',
        outline: 'none',
    };
    const labelStyle = {
        display: 'block',
        fontSize: '0.8125rem',
        fontWeight: '600',
        color: MAGNUS_COLORS.darkGreen,
        marginBottom: '0.375rem',
    };
    const tableStyle = {
        width: '100%',
        borderCollapse: 'collapse',
    };
    const thStyle = {
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
    const tdStyle = {
        padding: '0.75rem 1rem',
        borderBottom: `1px solid ${MAGNUS_COLORS.divider}`,
        fontSize: '0.875rem',
        color: MAGNUS_COLORS.secondaryText,
    };
    // ============================================================================
    // Render
    // ============================================================================
    return (_jsxs("div", { style: containerStyle, children: [_jsxs("div", { style: headerStyle, children: [_jsx("h2", { style: titleStyle, children: " User Management" }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("button", { style: secondaryButtonStyle, onClick: refresh, disabled: loading, children: "Refresh" }), _jsx("button", { style: primaryButtonStyle, onClick: () => setShowAddForm(true), children: "Add User" })] })] }), err && (_jsx("div", { style: {
                    padding: '1rem',
                    backgroundColor: MAGNUS_COLORS.offWhite,
                    border: `1px solid ${MAGNUS_COLORS.critical}`,
                    borderRadius: '0.5rem',
                    color: MAGNUS_COLORS.critical,
                    marginBottom: '1rem',
                }, children: err })), showAddForm && (_jsxs("div", { style: cardStyle, children: [_jsx("div", { style: { padding: '1rem', borderBottom: `1px solid ${MAGNUS_COLORS.border}`, backgroundColor: MAGNUS_COLORS.offWhite }, children: _jsx("h3", { style: { margin: 0, fontSize: '1rem', fontWeight: '600', color: MAGNUS_COLORS.darkGreen }, children: "Add New User" }) }), _jsxs("form", { onSubmit: handleSubmit, style: { padding: '1.5rem' }, children: [_jsxs("div", { style: { display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }, children: [_jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Name *" }), _jsx("input", { type: "text", style: inputStyle, value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), placeholder: "John Doe" })] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Email *" }), _jsx("input", { type: "email", style: inputStyle, value: formData.email, onChange: (e) => setFormData({ ...formData, email: e.target.value }), placeholder: `user${ALLOWED_DOMAIN}` })] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Password *" }), _jsx("input", { type: "password", style: inputStyle, value: formData.password, onChange: (e) => setFormData({ ...formData, password: e.target.value }), placeholder: "Min 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { style: labelStyle, children: "Role *" }), _jsx("select", { style: inputStyle, value: formData.role, onChange: (e) => setFormData({ ...formData, role: e.target.value }), children: Object.entries(ROLE_INFO).map(([key, info]) => (_jsx("option", { value: key, children: info.label }, key))) })] })] }), formError && (_jsx("div", { style: { marginTop: '1rem', color: colors.red600, fontSize: '0.875rem' }, children: formError })), _jsxs("div", { style: { marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }, children: [_jsx("button", { type: "button", style: secondaryButtonStyle, onClick: resetForm, children: "Cancel" }), _jsx("button", { type: "submit", style: primaryButtonStyle, disabled: submitting, children: submitting ? 'Creating...' : 'Create User' })] })] })] })), _jsxs("div", { style: cardStyle, children: [_jsx("div", { style: { padding: '1rem', borderBottom: `1px solid ${colors.gray200}`, backgroundColor: colors.gray50 }, children: _jsxs("h3", { style: { margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.gray800 }, children: ["Users (", users.length, ")"] }) }), loading ? (_jsx("div", { style: { padding: '2rem', textAlign: 'center', color: colors.gray500 }, children: "Loading users..." })) : users.length === 0 ? (_jsx("div", { style: { padding: '2rem', textAlign: 'center', color: colors.gray500 }, children: "No users found" })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: tableStyle, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: thStyle, children: "User" }), _jsx("th", { style: thStyle, children: "Role" }), _jsx("th", { style: thStyle, children: "Created" }), _jsx("th", { style: { ...thStyle, textAlign: 'right' }, children: "Actions" })] }) }), _jsx("tbody", { children: users.map((user) => (_jsxs("tr", { style: { opacity: busyId === user.id ? 0.5 : 1 }, children: [_jsxs("td", { style: tdStyle, children: [_jsx("div", { style: { fontWeight: '600', color: colors.gray800 }, children: user.name || 'No name' }), _jsx("div", { style: { fontSize: '0.75rem', color: colors.gray500 }, children: user.email })] }), _jsx("td", { style: tdStyle, children: _jsx("select", { value: user.role, onChange: (e) => handleRoleChange(user.id, e.target.value), disabled: busyId === user.id, style: {
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '0.375rem',
                                                        border: `1px solid ${colors.gray300}`,
                                                        backgroundColor: ROLE_INFO[user.role]?.bgColor || colors.gray100,
                                                        color: ROLE_INFO[user.role]?.color || colors.gray700,
                                                        fontWeight: '600',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer',
                                                    }, children: Object.entries(ROLE_INFO).map(([key, info]) => (_jsx("option", { value: key, children: info.label }, key))) }) }), _jsx("td", { style: tdStyle, children: user.created_at
                                                    ? new Date(user.created_at).toLocaleDateString()
                                                    : '-' }), _jsx("td", { style: { ...tdStyle, textAlign: 'right' }, children: _jsx("button", { style: {
                                                        ...dangerButtonStyle,
                                                        padding: '0.25rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                    }, onClick: () => handleDelete(user.id), disabled: busyId === user.id, children: "Delete" }) })] }, user.id))) })] }) }))] }), _jsxs("div", { style: cardStyle, children: [_jsx("div", { style: { padding: '1rem', borderBottom: `1px solid ${colors.gray200}`, backgroundColor: colors.gray50 }, children: _jsx("h3", { style: { margin: 0, fontSize: '1rem', fontWeight: '600', color: colors.gray800 }, children: "Role Descriptions" }) }), _jsx("div", { style: { padding: '1rem' }, children: _jsx("div", { style: { display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }, children: Object.entries(ROLE_INFO).map(([key, info]) => (_jsxs("div", { style: {
                                    padding: '1rem',
                                    backgroundColor: info.bgColor,
                                    borderRadius: '0.5rem',
                                    border: `1px solid ${info.color}20`,
                                }, children: [_jsx("div", { style: { fontWeight: '700', color: info.color, marginBottom: '0.25rem' }, children: info.label }), _jsx("div", { style: { fontSize: '0.8125rem', color: colors.gray600 }, children: info.description })] }, key))) }) })] })] }));
}
export default UserManagementInline;
