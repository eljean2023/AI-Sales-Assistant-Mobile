import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

interface StatusBadgeProps {
  label: string;
  active: boolean;
}

export function StatusBadge({ label, active }: StatusBadgeProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: active ? colors.primary : colors.textMuted }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
  },
});
