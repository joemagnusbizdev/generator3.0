import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { colors, combine } from '../styles/inline';
import { cards, buttons, badges, typography } from '../styles/designSystem';
// ============================================================================
// Severity Styles
// ============================================================================
const severityColors = {
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
const severityBadges = {
    critical: badges.severity.critical,
    warning: badges.severity.warning,
    caution: badges.severity.caution,
    informative: badges.severity.informative,
};
// ============================================================================
// Component
// ============================================================================
export function EnhancedAlertCard({ alert, onDelete, onApprove, onDismiss, busy = false, showActions = true, }) {
    const severity = alert.severity?.toLowerCase() ?? 'informative';
    const severityStyle = severityColors[severity] ?? severityColors.informative;
    const badgeStyle = severityBadges[severity] ?? badges.severity.informative;
    const cardStyle = combine(cards.base, severityStyle, {
        marginBottom: '1rem',
        transition: 'box-shadow 0.2s ease',
        opacity: busy ? 0.7 : 1,
        pointerEvents: busy ? 'none' : 'auto',
    });
    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '0.75rem',
    };
    const titleStyle = combine(typography.h4, {
        margin: 0,
        flex: 1,
        paddingRight: '1rem',
    });
    const metaStyle = {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        fontSize: '0.875rem',
        color: colors.gray600,
    };
    const actionsStyle = {
        display: 'flex',
        gap: '0.5rem',
        marginTop: '1rem',
        flexWrap: 'wrap',
    };
    const linkStyle = {
        color: colors.magnusDarkGreen,
        textDecoration: 'none',
        fontSize: '0.875rem',
    };
    return (_jsxs("div", { style: cardStyle, children: [_jsxs("div", { style: headerStyle, children: [_jsx("h4", { style: titleStyle, children: alert.title }), _jsx("span", { style: badgeStyle, children: severity.charAt(0).toUpperCase() + severity.slice(1) })] }), _jsxs("div", { style: metaStyle, children: [alert.location && (_jsxs("span", { children: [" ", alert.location] })), alert.country && !alert.location && (_jsxs("span", { children: [" ", alert.country] })), alert.region && (_jsxs("span", { children: [" ", alert.region] })), (alert.intelligence_topics || alert.event_type) && (_jsxs("span", { children: [" ", alert.intelligence_topics || alert.event_type] })), alert.created_at && (_jsxs("span", { children: [" ", new Date(alert.created_at).toLocaleDateString()] })), alert.status && (_jsx("span", { style: {
                            padding: '2px 8px',
                            backgroundColor: colors.gray200,
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                        }, children: alert.status }))] }), (alert.sourceUrl || alert.articleUrl) && (_jsxs("div", { style: { marginBottom: '0.5rem' }, children: [alert.sourceUrl && (_jsx("a", { href: alert.sourceUrl, target: "_blank", rel: "noopener noreferrer", style: linkStyle, children: "View Source" })), alert.sourceUrl && alert.articleUrl && _jsx("span", { style: { margin: '0 0.5rem' }, children: "|" }), alert.articleUrl && (_jsx("a", { href: alert.articleUrl, target: "_blank", rel: "noopener noreferrer", style: linkStyle, children: "View Article" }))] })), showActions && (onApprove || onDismiss || onDelete) && (_jsxs("div", { style: actionsStyle, children: [onApprove && (_jsx("button", { onClick: () => onApprove(alert.id), disabled: busy, style: combine(buttons.primary, buttons.small), children: busy ? 'Processing...' : 'Approve' })), onDismiss && (_jsx("button", { onClick: () => onDismiss(alert.id), disabled: busy, style: combine(buttons.secondary, buttons.small), children: "Dismiss" })), onDelete && (_jsx("button", { onClick: () => onDelete(alert.id), disabled: busy, style: combine(buttons.danger, buttons.small), children: busy ? 'Deleting...' : 'Delete' }))] }))] }));
}
export default EnhancedAlertCard;
