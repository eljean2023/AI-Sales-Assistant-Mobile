import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getNotification } from "../../../src/api/notifications.api";
import type { MobileNotification } from "../../../src/api/types";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { getNotificationVisual, relativeTime } from "../../../src/notifications/presentation";
import { colors } from "../../../src/theme/colors";

export default function NotificationDetailScreen() {
  // Opened from a push tap: title/body/data arrive as route params directly (see
  // notificationRouter.ts). Opened from the Notification Center list: only `id` is passed, so
  // the full record is fetched from the backend below.
  const { id, title, body, data } = useLocalSearchParams<{ id: string; title?: string; body?: string; data?: string }>();

  const [fetched, setFetched] = useState<MobileNotification | null>(null);
  const [isLoading, setIsLoading] = useState(!title);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (title || !id) return;
    setIsLoading(true);
    getNotification(id)
      .then(setFetched)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [id, title]);

  if (title) {
    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = data ? JSON.parse(data) : {};
    } catch {
      parsedData = {};
    }

    return (
      <Screen>
        <Card style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          {Object.keys(parsedData).length > 0 ? (
            <Text style={styles.debugData}>{JSON.stringify(parsedData, null, 2)}</Text>
          ) : null}
        </Card>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <Card style={[styles.card, styles.centered]}>
          <ActivityIndicator color={colors.textSecondary} />
        </Card>
      </Screen>
    );
  }

  if (error || !fetched) {
    return (
      <Screen>
        <Card style={[styles.card, styles.centered]}>
          <Ionicons name="alert-circle-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyLabel}>Couldn't load this notification</Text>
        </Card>
      </Screen>
    );
  }

  const visual = getNotificationVisual(fetched.source, fetched.type);

  return (
    <Screen>
      <Card style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: `${visual.color}33` }]}>
          <Ionicons name={visual.icon} size={22} color={visual.color} />
        </View>
        <Text style={styles.title}>{fetched.title}</Text>
        {fetched.body ? <Text style={styles.body}>{fetched.body}</Text> : null}
        <Text style={styles.time}>{relativeTime(fetched.createdAt)}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 16,
  },
  time: {
    color: colors.textMuted,
    fontSize: 13,
  },
  debugData: {
    color: colors.textMuted,
    fontSize: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLabel: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
});
