import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Screen } from "../../../src/components/ui/Screen";

export default function NotificationDetailScreen() {
  const { title, body, data } = useLocalSearchParams<{ title: string; body: string; data: string }>();

  let parsedData: Record<string, unknown> = {};
  try {
    parsedData = data ? JSON.parse(data) : {};
  } catch {
    parsedData = {};
  }

  return (
    <Screen>
      <Text style={{ color: "#F5F7FA", fontSize: 20, fontWeight: "700", marginBottom: 12 }}>{title}</Text>
      <Text style={{ color: "#A9B1BD", fontSize: 16, marginBottom: 16 }}>{body}</Text>
      {Object.keys(parsedData).length > 0 ? (
        <Text style={{ color: "#5B6472", fontSize: 12 }}>{JSON.stringify(parsedData, null, 2)}</Text>
      ) : null}
    </Screen>
  );
}
