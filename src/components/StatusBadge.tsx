import { StyleSheet, Text, View } from "react-native";

interface StatusBadgeProps {
  label: string;
  active: boolean;
}

export function StatusBadge({ label, active }: StatusBadgeProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: active ? "#3DDC84" : "#5B6472" }]} />
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
    color: "#F5F7FA",
    fontSize: 14,
  },
});
