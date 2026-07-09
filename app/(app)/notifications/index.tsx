import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../../src/components/ui/Screen";
import { type NotificationItem, useNotificationCenter } from "../../../src/notifications/NotificationCenterContext";
import { getNotificationVisual, groupByDay, relativeTime } from "../../../src/notifications/presentation";
import { colors } from "../../../src/theme/colors";

export default function NotificationsScreen() {
  const { notifications, unreadCount, isLoading, refresh, markOneRead, markAllAsRead, deleteOne, deleteAll } =
    useNotificationCenter();

  const sections = groupByDay(notifications).map((group) => ({
    title: `${group.label} (${group.items.length})`,
    data: group.items,
  }));

  const handlePress = async (item: NotificationItem) => {
    if (!item.read) await markOneRead(item.id);
    if (item.memberIds) {
      router.push({ pathname: "/notification/[id]", params: { id: item.id, title: item.title, body: item.body ?? "" } });
    } else {
      router.push({ pathname: "/notification/[id]", params: { id: item.id } });
    }
  };

  const handleDelete = (item: NotificationItem) => {
    Alert.alert("Delete notification?", "This only removes it from your Notification Center.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteOne(item.memberIds ?? [item.id]) },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert("Clear all notifications?", "This only affects your Notification Center.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear all", style: "destructive", onPress: () => deleteAll() },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 ? (
            <Pressable onPress={() => markAllAsRead()} hitSlop={8}>
              <Text style={styles.markAllLabel}>Mark all as read</Text>
            </Pressable>
          ) : null}
          {notifications.length > 0 ? (
            <Pressable onPress={handleClearAll} hitSlop={8}>
              <Text style={styles.clearAllLabel}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />}
        renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
        renderItem={({ item }) => (
          <NotificationRow item={item} onPress={() => handlePress(item)} onDelete={() => handleDelete(item)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyLabel}>No notifications yet</Text>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function NotificationRow({
  item,
  onPress,
  onDelete,
}: {
  item: NotificationItem;
  onPress: () => void;
  onDelete: () => void;
}) {
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

      <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteButton}>
        <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
      </Pressable>
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
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  markAllLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  clearAllLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  sectionLabel: {
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 14,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
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
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
  },
  rowTitleUnread: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  rowBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  rowTime: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 6,
  },
  separator: {
    height: 10,
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
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
});
