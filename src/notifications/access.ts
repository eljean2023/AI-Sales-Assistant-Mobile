// Single source of truth for which roles get the Notification Center (bell + list). Both the
// bell (Home) and NotificationCenterContext check this so the gate can't drift between the two.
const NOTIFICATION_CENTER_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

export function hasNotificationCenterAccess(role: string | undefined | null): boolean {
  return !!role && NOTIFICATION_CENTER_ROLES.has(role);
}
