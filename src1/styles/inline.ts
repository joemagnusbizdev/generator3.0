// Complete inline styles system - MAGNUS Brand Colors
// Backwards-compatible exports: colors, styles, combine
// Modern TS/React compatibility (react-jsx): no React global required

import type { CSSProperties } from "react";

export const colors = {
  // MAGNUS Primary Colors
  magnusDarkGreen: "#1A4234",
  magnusGreen: "#2D5A47",
  magnusLightGreen: "#4A7A64",
  magnusAccentGreen: "#065831",
  magnusOrange: "#E67E22",
  magnusOrangeLight: "#F39C12",

  // Background Colors
  magnusLightBg: "#F8FAF9",
  magnusCardBg: "#FFFFFF",
  magnusBorder: "#E2E8F0",

  // Text Colors
  textPrimary: "#1A4234",
  textSecondary: "#4A5568",
  textMuted: "#718096",
  magnusDarkText: "#1A2622",

  // Status Colors
  success: "#38A169",
  warning: "#ED8936",
  danger: "#E53E3E",
  info: "#3182CE",

  // White
  white: "#FFFFFF",

  // Gray Scale
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#111827",

  // Slate (for subtle text)
  slate600: "#475569",

  // Blue (links, info)
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  blue200: "#bfdbfe",
  blue300: "#93c5fd",
  blue400: "#60a5fa",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  blue700: "#1d4ed8",
  blue800: "#1e40af",
  blue900: "#1e3a8a",

  // Green
  green50: "#f0fdf4",
  green100: "#dcfce7",
  green200: "#bbf7d0",
  green500: "#22c55e",
  green600: "#16a34a",
  green700: "#15803d",

  // Orange (MAGNUS)
  orange50: "#fff7ed",
  orange100: "#ffedd5",
  orange200: "#fed7aa",
  orange300: "#fdba74",
  orange400: "#fb923c",
  orange500: "#f97316",
  orange600: "#ea580c",
  orange700: "#c2410c",
  orange800: "#9a3412",
  orange900: "#7c2d12",

  // Red (alerts)
  red50: "#fef2f2",
  red100: "#fee2e2",
  red200: "#fecaca",
  red300: "#fca5a5",
  red400: "#f87171",
  red500: "#ef4444",
  red600: "#dc2626",
  red700: "#b91c1c",
  red800: "#991b1b",
  red900: "#7f1d1d",

  // Purple (secondary actions)
  purple50: "#faf5ff",
  purple100: "#f3e8ff",
  purple200: "#e9d5ff",
  purple300: "#d8b4fe",
  purple400: "#c084fc",
  purple500: "#a855f7",
  purple600: "#9333ea",
  purple700: "#7e22ce",
  purple800: "#6b21a8",
  purple900: "#581c87",
} as const;

export const styles: Record<string, CSSProperties> = {
  // Layout
  minHScreen: { minHeight: "100vh", backgroundColor: colors.magnusLightBg },

  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    paddingLeft: "1.5rem",
    paddingRight: "1.5rem",
  },

  py8: { paddingTop: "2rem", paddingBottom: "2rem" },

  // Cards
  card: {
    backgroundColor: colors.magnusCardBg,
    borderRadius: "1rem",
    border: `1px solid ${colors.magnusBorder}`,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },

  cardHeader: { padding: "1.5rem", borderBottom: `1px solid ${colors.magnusBorder}` },
  cardContent: { padding: "1.5rem" },

  // Buttons
  button: {
    padding: "0.5rem 1rem",
    borderRadius: "0.5rem",
    border: "none",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: "500",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    transition: "all 0.2s",
  },

  buttonPrimary: { backgroundColor: colors.magnusOrange, color: "white" },
  buttonSecondary: {
    backgroundColor: colors.gray100,
    color: colors.textPrimary,
    border: `1px solid ${colors.magnusBorder}`,
  },
  buttonOutline: { backgroundColor: "transparent", color: colors.textPrimary, border: `1px solid ${colors.magnusBorder}` },
  buttonDisabled: { opacity: 0.5, cursor: "not-allowed" },

  // Inputs
  input: {
    width: "100%",
    padding: "0.5rem 0.75rem",
    borderRadius: "0.5rem",
    border: `1px solid ${colors.magnusBorder}`,
    fontSize: "0.875rem",
    backgroundColor: "white",
    outline: "none",
  },

  // Text
  h1: { fontSize: "1.875rem", fontWeight: "700", color: colors.textPrimary, marginBottom: "0.5rem" },
  h2: { fontSize: "1.5rem", fontWeight: "600", color: colors.textPrimary, marginBottom: "0.5rem" },
  textMuted: { color: colors.textMuted, fontSize: "0.875rem" },

  // Badges
  badge: { display: "inline-flex", alignItems: "center", borderRadius: "999px", padding: "0.125rem 0.625rem", fontSize: "0.75rem", fontWeight: "600" },
  badgeSecondary: { backgroundColor: colors.gray100, color: colors.gray800 },
  badgeDanger: { backgroundColor: colors.red100, color: colors.red700 },

  // Utility
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" },
  colGap3: { display: "grid", gap: "0.75rem" },
};

type StyleLike = CSSProperties | undefined | null | false;

/**
 * combine(styles.a, condition && styles.b, maybe && {...})
 * supports falsy values safely (modern pattern)
 */
export const combine = (...styleObjects: StyleLike[]): CSSProperties => {
  const filtered = styleObjects.filter(Boolean) as CSSProperties[];
  return Object.assign({}, ...filtered);
};



