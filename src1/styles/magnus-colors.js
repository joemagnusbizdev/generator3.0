/**
 * MAGNUS Brand Color System
 *
 * These colors define the MAGNUS identity across all UI and exports.
 * Use consistently for brand recognition and professional appearance.
 */
export const MAGNUS_COLORS = {
    // Primary Brand Colors
    darkGreen: '#144334', // Main backgrounds, headers, brand blocks
    deepGreen: '#1A6B51', // Secondary backgrounds, UI sections, cards, footer
    orange: '#F88A35', // CTAs, highlights, icons, emphasis
    offWhite: '#F9F8F6', // Page backgrounds, contrast areas
    // Text & Neutral Colors
    primaryText: '#192622', // Main body text
    secondaryText: '#17221E', // Supporting text, secondary information
    tertiaryText: '#1C332A', // Tertiary information, subtler text
    // Semantic Colors (for alert status indicators)
    critical: '#dc2626', // Critical severity
    warning: '#ea580c', // Warning severity
    caution: '#facc15', // Caution/yellow severity
    informative: '#3b82f6', // Informative/blue severity
    // Functional Colors
    success: '#059669', // Success states
    error: '#dc2626', // Error states
    border: '#e5e7eb', // Border color (light)
    borderDark: '#1A6B51', // Border color (dark, uses deepGreen)
    divider: '#d1d5db', // Divider lines
    background: '#f9fafb', // Page background (light)
    surface: '#ffffff', // Card/surface background
    surfaceAlt: '#f3f4f6', // Alternative surface
};
/**
 * Tailwind-compatible color definitions
 * Use in className combinations like "bg-magnus-dark-green"
 */
export const tailwindColorMap = {
    'magnus-dark-green': MAGNUS_COLORS.darkGreen,
    'magnus-deep-green': MAGNUS_COLORS.deepGreen,
    'magnus-orange': MAGNUS_COLORS.orange,
    'magnus-off-white': MAGNUS_COLORS.offWhite,
    'magnus-text-primary': MAGNUS_COLORS.primaryText,
    'magnus-text-secondary': MAGNUS_COLORS.secondaryText,
};
/**
 * Helper function to get severity color by severity level
 */
export function getSeverityColor(severity) {
    if (!severity)
        return MAGNUS_COLORS.informative;
    const severityLower = severity.toLowerCase();
    switch (severityLower) {
        case 'critical':
            return MAGNUS_COLORS.critical;
        case 'warning':
            return MAGNUS_COLORS.warning;
        case 'caution':
            return MAGNUS_COLORS.caution;
        case 'informative':
            return MAGNUS_COLORS.informative;
        default:
            return MAGNUS_COLORS.informative;
    }
}
/**
 * Helper function to get ACF severity color for WordPress
 */
export function mapSeverityToACF(severity) {
    if (!severity)
        return 'yellow';
    const severityLower = severity.toLowerCase();
    switch (severityLower) {
        case 'critical':
            return 'darkred';
        case 'warning':
            return 'orange';
        case 'caution':
            return 'yellow';
        case 'informative':
            return 'green';
        default:
            return 'yellow';
    }
}
export default MAGNUS_COLORS;
