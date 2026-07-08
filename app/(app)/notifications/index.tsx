import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../../src/components/ui/Screen";
import { type NotificationItem, useNotificationCenter } from "../../../src/notifications/NotificationCenterContext";
import { getNotificationVisual, groupByDay, relativeTime } from "../../../src/notifications/presentation";

export default function NotificationsScreen() {
  const { notifications, unreadCount, isLoading, refresh, markOneRead, markAllAsRead } = useNotificationCenter();

  const sections = groupByDay(notifications).map((group) => ({ title: group.label, data: group.items }));

  const handlePress = async (item: NotificationItem) => {
    if (!item.read) await markOneRead(item.id);
    router.push({ pathname: "/notification/[id]", params: { id: item.id } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={() => markAllAsRead()} hitSlop={8}>
            <Text style={styles.markAllLabel}>Mark all as read</Text>
          </Pressable>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#A9B1BD" />}
        renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
        renderItem={({ item }) => <NotificationRow item={item} onPress={() => handlePress(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={32} color="#5B6472" />
              <Text style={styles.emptyLabel}>No notifications yet</Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function NotificationRow({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const visual = getNotificationVisual(item.source, item.type);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[styles.iconWrap, { backgroundColor: `${visual.color}26` }]}>
        <Ionicons name={visual.icon} size={18} color={visual.color} />
      </View>

      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.body ? (
          <Text style={styles.rowBody} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
      </View>

      {!item.read ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    color: "#F5F7FA",
    fontSize: 22,
    fontWeight: "700",
  },
  markAllLabel: {
    color: "#4F9DFF",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionLabel: {
    color: "#8B96A8",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    color: "#A9B1BD",
    fontSize: 15,
    fontWeight: "500",
  },
  rowTitleUnread: {
    color: "#F5F7FA",
    fontWeight: "700",
  },
  rowBody: {
    color: "#8B96A8",
    fontSize: 13,
    marginTop: 2,
  },
  rowTime: {
    color: "#5B6472",
    fontSize: 12,
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4F9DFF",
    marginLeft: 8,
    marginTop: 6,
  },
  separator: {
    height: 16,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyLabel: {
    color: "#5B6472",
    fontSize: 14,
    marginTop: 12,
  },
});
