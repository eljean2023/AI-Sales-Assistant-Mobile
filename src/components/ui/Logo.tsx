import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { colors } from "../../theme/colors";

interface LogoProps {
  size?: number;
}

// Custom app emblem: an upward sales trend mark in a rounded badge, with a small
// sparkle accent overlapping the corner to signal the "AI" half of the product.
// Built from theme colors + vector icons so it always matches the live palette.
export function Logo({ size = 56 }: LogoProps) {
  const accentSize = size * 0.42;

  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Ionicons name="trending-up" size={size * 0.52} color={colors.onPrimary} />
      <View
        style={[
          styles.accent,
          {
            width: accentSize,
            height: accentSize,
            borderRadius: accentSize / 2,
            top: -accentSize * 0.22,
            right: -accentSize * 0.22,
            borderWidth: Math.max(2, size * 0.035),
          },
        ]}
      >
        <Ionicons name="sparkles" size={accentSize * 0.56} color={colors.primaryStrong} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.primaryStrong,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  accent: {
    position: "absolute",
    backgroundColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
});
