/**
 * MAGNUS Intelligence Alert Generator - Main App
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase/client';
import { getApiUrl } from './lib/supabase/api';
import { colors, styles, combine } from './styles/inline';
import { buttons, typography, layout } from './styles/designSystem';

// Components
import {
  ScourProvider,
  AlertReviewQueueInline,
  AlertCreateInline,
  AnalyticsDashboardInline,
  SourceManagerInline,
  TrendsView,
  UserManagementInline,
  ScourStatusBarInline,
} from './components';

// Permissions
import {
  type Role,
  type PermissionSet,
  getPermissions,
  normalizeRole,
  getRoleLabel,
  getVisibleTabs,
} from './lib/permissions';

// ============================================================================
// Types
// ============================================================================

type TabId = 'review' | 'create' | 'sources' | 'trends' | 'analytics' | 'admin';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

// ============================================================================
// Constants
// ============================================================================

const ALL_TABS: Tab[] = [
  { id: 'review', label: 'Review', icon: '📋' },
  { id: 'create', label: 'Create', icon: '✏️' },
  { id: 'sources', label: 'Sources', icon: '📰' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'admin', label: 'Admin', icon: '⚙️' },
];

// ============================================================================
// Helpers
// ============================================================================

function canAccessTab(role: Role, tabId: TabId): boolean {
  const perms = getPermissions(role);
  switch (tabId) {
    case 'review': return perms.canReview;
    case 'create': return perms.canCreate;
    case 'sources': return perms.canManageSources;
    case 'trends': return perms.canViewTrends;
    case 'analytics': return perms.canAccessAnalytics;
    case 'admin': return perms.canManageUsers;
    default: return false;
  }
}

// ============================================================================
// Main App Component
// ============================================================================

export default function App(): JSX.Element {
  // Auth state
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('operator');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>('review');

  // Computed
  const permissions = getPermissions(role);
  const apiBase = getApiUrl('');

  // Auth effect
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session?.user && mounted) {
          setUser({ id: session.user.id, email: session.user.email });
          setAccessToken(session.access_token);
          setRole(normalizeRole(session.user.user_metadata?.role as string));
        }
      } catch (err) {
        if (mounted) {
          setAuthError(err instanceof Error ? err.message : 'Auth error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email });
          setAccessToken(session.access_token);
          setRole(normalizeRole(session.user.user_metadata?.role as string));
        } else {
          setUser(null);
          setAccessToken(null);
          setRole('operator');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Login handler
  const handleLogin = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        setUser({ id: data.session.user.id, email: data.session.user.email });
        setAccessToken(data.session.access_token);
        setRole(normalizeRole(data.session.user.user_metadata?.role as string));
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout handler
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
    setRole('operator');
    setActiveTab('review');
  }, []);

  // Filter tabs based on role permissions
  const visibleTabs = ALL_TABS.filter(tab => canAccessTab(role, tab.id));

  // Ensure active tab is visible
  useEffect(() => {
    const isVisible = visibleTabs.some(t => t.id === activeTab);
    if (!isVisible && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  // ============================================================================
  // Styles
  // ============================================================================

  const appStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: colors.magnusLightBg,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: colors.magnusDarkGreen,
    color: 'white',
    padding: '1rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 700,
    letterSpacing: '-0.025em',
  };

  const userInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '0.875rem',
  };

  const navStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderBottom: `1px solid ${colors.gray200}`,
    padding: '0 1rem',
  };

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    maxWidth: '1280px',
    margin: '0 auto',
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '1rem 1.25rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: active ? colors.magnusDarkGreen : colors.gray600,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    borderBottom: `3px solid ${active ? colors.magnusDarkGreen : 'transparent'}`,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  });

  const mainStyle: React.CSSProperties = {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '1.5rem',
    paddingBottom: '5rem', // Space for status bar
  };

  const loginCardStyle: React.CSSProperties = {
    maxWidth: '400px',
    margin: '100px auto',
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  };

  // ============================================================================
  // Login Form Component
  // ============================================================================

  function LoginForm(): JSX.Element {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleLogin(email, password);
    };

    return (
      <div style={appStyle}>
        <div style={{ ...headerStyle, justifyContent: 'center' }}>
          <div style={logoStyle}>
            <span style={{ fontSize: '2rem' }}>ðŸ›¡ï¸</span>
            <span style={logoTextStyle}>MAGNUS Intelligence</span>
          </div>
        </div>

        <div style={loginCardStyle}>
          <h2 style={{ 
            textAlign: 'center', 
            marginBottom: '1.5rem',
            color: colors.magnusDarkGreen,
          }}>
            Sign In
          </h2>

          {authError && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: colors.red50,
              border: `1px solid ${colors.red200}`,
              borderRadius: '8px',
              color: colors.red700,
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              {authError}
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${colors.gray300}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${colors.gray300}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                backgroundColor: colors.magnusDarkGreen,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render Tab Content
  // ============================================================================

  function renderTabContent(): JSX.Element {
    switch (activeTab) {
      case 'review':
        return (
          <AlertReviewQueueInline
                        permissions={{
              canReview: permissions.canReview,
              canScour: permissions.canScour,
              canApproveAndPost: permissions.canApproveAndPost,
              canDismiss: permissions.canDismiss,
              canDelete: permissions.canDelete,
              canEditAlerts: permissions.canEditAlerts,
            }}
          />
        );

      case 'create':
        return (
          <AlertCreateInline
            accessToken={accessToken ?? undefined}
            permissions={{ 
              canCreate: permissions.canCreate,
            }}
            onAlertCreated={(alert) => {
              console.log('Alert created:', alert);
              // Optionally switch to review tab
              // setActiveTab('review');
            }}
          />
        );

      case 'sources':
        return (
          <SourceManagerInline
            accessToken={accessToken ?? undefined}
            permissions={{
              canManageSources: permissions.canManageSources,
              canScour: permissions.canScour,
            }}
          />
        );

      case 'trends':
        return (
          <TrendsView
            accessToken={accessToken ?? undefined}
            permissions={{ 
              canViewTrends: permissions.canViewTrends,
            }}
          />
        );

      case 'analytics':
        return (
          <AnalyticsDashboardInline
            apiBase={apiBase}
            accessToken={accessToken ?? undefined}
            permissions={{ 
              canAccessAnalytics: permissions.canAccessAnalytics,
              canViewDetailedStats: permissions.canViewDetailedStats,
              canExportAnalytics: permissions.canExportAnalytics,
            }}
          />
        );

      case 'admin':
        return (
          <UserManagementInline
            accessToken={accessToken ?? undefined}
            currentUserRole={role}
            permissions={{ 
              canManageUsers: permissions.canManageUsers,
              canViewUsers: permissions.canViewUsers,
              canChangeRoles: permissions.canChangeRoles,
            }}
          />
        );

      default:
        return <div>Unknown tab</div>;
    }
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  // Show loading
  if (loading && !user) {
    return (
      <div style={appStyle}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100vh',
          color: colors.gray500,
        }}>
          Loading...
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginForm />;
  }

  // Main app
  return (
    <ScourProvider accessToken={accessToken ?? undefined}>
      <div style={appStyle}>
        {/* Header */}
        <header style={headerStyle}>
          <div style={logoStyle}>
            <span style={{ fontSize: '1.5rem' }}>ðŸ›¡ï¸</span>
            <span style={logoTextStyle}>MAGNUS Intelligence</span>
          </div>

          <div style={userInfoStyle}>
            <span>{user.email}</span>
            <span style={{
              padding: '4px 8px',
              backgroundColor: role === 'admin' ? 'rgba(220,38,38,0.3)' : role === 'analyst' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.2)',
              borderRadius: '4px',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}>
              {getRoleLabel(role)}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Navigation */}
        <nav style={navStyle}>
          <div style={tabsStyle}>
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={tabStyle(activeTab === tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <main style={mainStyle}>
          {renderTabContent()}
        </main>

        {/* Scour Status Bar */}
        <ScourStatusBarInline />
      </div>
    </ScourProvider>
  );
}
