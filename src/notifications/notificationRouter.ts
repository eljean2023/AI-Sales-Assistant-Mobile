export interface NotificationContent {
  title?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
}

export interface NotificationRoute {
  pathname: "/notification/[id]";
  params: { id: string; title: string; body: string; data: string };
}

/** Turns a received notification's content into an Expo Router destination.
 * The backend may include a `notificationId` in `data` for correlation; we
 * fall back to a locally generated id since this app has no notification
 * history store to look one up from. */
export function buildNotificationRoute(content: NotificationContent): NotificationRoute {
  const data = content.data ?? {};
  const id = typeof data.notificationId === "string" ? data.notificationId : `local-${Date.now()}`;

  return {
    pathname: "/notification/[id]",
    params: {
      id,
      title: content.title ?? "AI Sales Assistant",
      body: content.body ?? "",
      data: JSON.stringify(data),
    },
  };
}
