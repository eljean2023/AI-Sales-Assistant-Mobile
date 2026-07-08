import { router } from "expo-router";
import { Text, View } from "react-native";

import { useAuth } from "../../src/auth/useAuth";
import { StatusBadge } from "../../src/components/StatusBadge";
import { NotificationBell } from "../../src/components/NotificationBell";
import { Button } from "../../src/components/ui/Button";
import { Screen } from "../../src/components/ui/Screen";
import { useNotifications } from "../../src/notifications/NotificationContext";

export default function HomeScreen() {
  const { user } = useAuth();
  const { lastNotification, notificationsEnabled } = useNotifications();

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "#F5F7FA", fontSize: 22, fontWeight: "700" }}>
          Welcome{user?.name ? `, ${user.name}` : ""}
        </Text>
        <NotificationBell />
      </View>

      <View style={{ marginTop: 24, marginBottom: 24 }}>
        <StatusBadge
          label={notificationsEnabled ? "Notifications enabled" : "Notifications disabled"}
          active={notificationsEnabled}
        />
      </View>

      <View style={{ marginBottom: 32 }}>
        <Text style={{ color: "#A9B1BD", fontSize: 13, marginBottom: 8 }}>Last notification</Text>
        <Text style={{ color: "#F5F7FA", fontSize: 16 }}>
          {lastNotification?.title ?? "No notifications received yet"}
        </Text>
        {lastNotification?.body ? (
          <Text style={{ color: "#A9B1BD", marginTop: 4 }}>{lastNotification.body}</Text>
        ) : null}
      </View>

      <Button label="Settings" onPress={() => router.push("/settings")} />
    </Screen>
  );
}
