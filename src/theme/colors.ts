// Single source of truth for the app's color palette (light green SaaS theme). Screens/components
// should import from here instead of hardcoding hex values, so a future palette change is a
// one-file edit.
export const colors = {
  background: "#F4FAF6",
  surface: "#FFFFFF",
  surfaceBorder: "#CDE6D9",
  primary: "#2FAE66",
  // Deeper shade of `primary`, reserved for contexts where it carries text/glyphs directly
  // (button labels, links) rather than sitting behind them — `primary` alone doesn't clear
  // 4.5:1 against white in either direction.
  primaryStrong: "#1B8850",
  primaryMuted: "#E4F5EA",
  textPrimary: "#173224",
  textSecondary: "#3D5646",
  textMuted: "#5F7A6C",
  // Darkened from a brighter #E0554F — as small text/icon color (error copy, "Clear all",
  // "Log out") the brighter red sat under 4:1 against white/surface.
  danger: "#CB423A",
  warning: "#C98A2E",
  success: "#2FAE66",
  shadow: "rgba(23, 50, 36, 0.10)",
  onPrimary: "#FFFFFF",
} as const;
