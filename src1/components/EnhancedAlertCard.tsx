/**
 * EnhancedAlertCard - Display component for alert items
 */
import React from 'react';
import { colors, styles, combine } from '../styles/inline';
import { cards, buttons, badges, typography } from '../styles/designSystem';

// ============================================================================
// Types
// ============================================================================

export interface Alert {
  id: string;
  title: string;
  location?: string;
  severity?: 'critical' | 'warning' | 'caution' | 'informative' | string;
  sourceUrl?: string;
  articleUrl?: string;
  country?: string;
  region?: string;
  event_type?: string;
  created_at?: string;
  status?: string;
}

interface EnhancedAlertCardProps {
  alert: Alert;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
  busy?: boolean;
  showActions?: boolean;
}

// ============================================================================
// Severity Styles
// ============================================================================

const severityColors: Record<string, React.CSSProperties> = {
  critical: {
    backgroundColor: colors.red50,
    borderLeftColor: colors.red500,
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
  },
  warning: {
    backgroundColor: colors.orange50,
    borderLeftColor: colors.orange500,
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
  },
  caution: {
    backgroundColor: colors.warning + '15',
    borderLeftColor: colors.warning,
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
  },
  informative: {
    backgroundColor: colors.blue50,
    borderLeftColor: colors.blue500,
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
  },
};

const severityBadges: Record<string, React.CSSProperties> = {
  critical: badges.severity.critical,
  warning: badges.severity.warning,
  caution: badges.severity.caution,
  informative: badges.severity.informative,
};

// ============================================================================
// Component
// ============================================================================

export function EnhancedAlertCard({
  alert,
  onDelete,
  onApprove,
  onDismiss,
  busy = false,
  showActions = true,
}: EnhancedAlertCardProps): JSX.Element {
  const severity = alert.severity?.toLowerCase() ?? 'informative';
  const severityStyle = severityColors[severity] ?? severityColors.informative;
  const badgeStyle = severityBadges[severity] ?? badges.severity.informative;

  const cardStyle: React.CSSProperties = combine(
    cards.base,
    severityStyle,
    {
      marginBottom: '1rem',
      transition: 'box-shadow 0.2s ease',
      opacity: busy ? 0.7 : 1,
      pointerEvents: busy ? 'none' : 'auto',
    }
  );

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  };

  const titleStyle: React.CSSProperties = combine(
    typography.h4,
    {
      margin: 0,
      flex: 1,
      paddingRight: '1rem',
    }
  );

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '0.75rem',
    fontSize: '0.875rem',
    color: colors.gray600,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
    flexWrap: 'wrap',
  };

  const linkStyle: React.CSSProperties = {
    color: colors.magnusDarkGreen,
    textDecoration: 'none',
    fontSize: '0.875rem',
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h4 style={titleStyle}>{alert.title}</h4>
        <span style={badgeStyle}>
          {severity.charAt(0).toUpperCase() + severity.slice(1)}
        </span>
      </div>

      <div style={metaStyle}>
        {alert.location && (
          <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â {alert.location}</span>
        )}
        {alert.country && !alert.location && (
          <span>ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â {alert.country}</span>
        )}
        {alert.region && (
          <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â {alert.region}</span>
        )}
        {alert.event_type && (
          <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ {alert.event_type}</span>
        )}
        {alert.created_at && (
          <span>ÃƒÂ°Ã…Â¸Ã¢â‚¬Â¢Ã¢â‚¬â„¢ {new Date(alert.created_at).toLocaleDateString()}</span>
        )}
        {alert.status && (
          <span style={{ 
            padding: '2px 8px', 
            backgroundColor: colors.gray200, 
            borderRadius: '4px',
            fontSize: '0.75rem',
          }}>
            {alert.status}
          </span>
        )}
      </div>

      {(alert.sourceUrl || alert.articleUrl) && (
        <div style={{ marginBottom: '0.5rem' }}>
          {alert.sourceUrl && (
            <a 
              href={alert.sourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={linkStyle}
            >
              View Source ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢
            </a>
          )}
          {alert.sourceUrl && alert.articleUrl && <span style={{ margin: '0 0.5rem' }}>|</span>}
          {alert.articleUrl && (
            <a 
              href={alert.articleUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={linkStyle}
            >
              View Article ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢
            </a>
          )}
        </div>
      )}

      {showActions && (onApprove || onDismiss || onDelete) && (
        <div style={actionsStyle}>
          {onApprove && (
            <button
              onClick={() => onApprove(alert.id)}
              disabled={busy}
              style={combine(buttons.primary, buttons.small)}
            >
              {busy ? 'Processing...' : 'Approve'}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(alert.id)}
              disabled={busy}
              style={combine(buttons.secondary, buttons.small)}
            >
              Dismiss
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(alert.id)}
              disabled={busy}
              style={combine(buttons.danger, buttons.small)}
            >
              {busy ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EnhancedAlertCard;




