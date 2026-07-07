import { StyleSheet, Switch, Text, View } from "react-native";

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({ label, description, value, onValueChange, disabled }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#2A3242", true: "#4F9DFF" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  textContainer: {
    flex: 1,
    paddingRight: 12,
  },
  label: {
    color: "#F5F7FA",
    fontSize: 16,
    fontWeight: "500",
  },
  description: {
    color: "#A9B1BD",
    fontSize: 13,
    marginTop: 2,
  },
});
