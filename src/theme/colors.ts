// Single source of truth for the app's color palette (light green SaaS theme). Screens/components
// should import from here instead of hardcoding hex values, so a future palette change is a
// one-file edit.
export const colors = {
  background: "#F4FAF6",
  surface: "#FFFFFF",
  surfaceBorder: "#DCEEE3",
  primary: "#2FAE66",
  primaryMuted: "#E4F5EA",
  textPrimary: "#173224",
  textSecondary: "#4E6B5A",
  textMuted: "#8FA79A",
  danger: "#E0554F",
  warning: "#C98A2E",
  success: "#2FAE66",
  shadow: "rgba(23, 50, 36, 0.08)",
  onPrimary: "#FFFFFF",
} as const;
