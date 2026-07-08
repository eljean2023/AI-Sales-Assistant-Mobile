import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../auth/useAuth";
import { hasNotificationCenterAccess } from "../notifications/access";
import { useNotificationCenter } from "../notifications/NotificationCenterContext";

// Self-gating: renders nothing for roles without a Notification Center, so callers (Home,
// future screens) never need to repeat the role check themselves.
export function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount } = useNotificationCenter();

  if (!hasNotificationCenterAccess(user?.role)) return null;

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="notifications-outline" size={24} color="#F5F7FA" />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: "#FF3B5C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#0B1220",
  },
  badgeLabel: {
    color: "#F5F7FA",
    fontSize: 10,
    fontWeight: "700",
  },
});
