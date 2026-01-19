/**
 * Components barrel export
 */

// Context
export { ScourProvider, useScour } from './ScourContext';
export type { ScourStartOpts, ScourTotals, ScourState } from './ScourContext';

// Alert components
export { default as EnhancedAlertCard } from './EnhancedAlertCard';
export type { Alert } from './EnhancedAlertCard';

export { default as AlertReviewQueueInline } from './AlertReviewQueueInline';

export { default as AlertCreateInline } from './AlertCreateInline';

// Dashboard and Analytics
export { default as AnalyticsDashboardInline } from './AnalyticsDashboardInline';

// Source Management
export { default as SourceManagerInline } from './SourceManagerInline';
export { SourceTable } from './SourceTable';
export type { Source } from './SourceTable';

// Trends
export { default as TrendsView } from './TrendsView';

// Admin
export { default as UserManagementInline } from './UserManagementInline';

// Status
export { default as ScourStatusBarInline } from './ScourStatusBarInline';
export { ScourStatusBar } from './ScourStatusBar';

// Settings
export { AutoScourSettings } from './AutoScourSettings';

// Geo/Map
export { default as GeoJsonPreview } from './GeoJsonPreview';





