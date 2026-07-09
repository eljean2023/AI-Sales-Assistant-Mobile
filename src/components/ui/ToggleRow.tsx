import { StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "../../theme/colors";

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
        trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
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
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
});
