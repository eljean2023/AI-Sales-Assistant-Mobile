import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import type { MobileNotification } from "../api/types";
import { colors } from "../theme/colors";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Category = "BUSINESS" | "PAYMENT" | "SYSTEM" | "SECURITY" | "TENANT";
type Priority = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "CRITICAL";

// Mirrors the category/priority classification already assigned to each PlatformEventType in
// the backend's lib/platform-events/registry.ts — that table isn't exposed by the list API, so
// it's reconstructed here purely for icon/accent-color choice. Adding a new PlatformEventType
// needs an entry here too, same as it needs one in the backend registry.
const PLATFORM_EVENT_META: Record<string, { category: Category; priority: Priority }> = {
  COMPANY_REGISTERED: { category: "BUSINESS", priority: "INFO" },
  USER_REGISTERED: { category: "BUSINESS", priority: "INFO" },
  TRIAL_STARTED: { category: "BUSINESS", priority: "INFO" },
  TRIAL_CONVERTED_TO_PAID: { category: "BUSINESS", priority: "SUCCESS" },
  TRIAL_EXPIRED: { category: "BUSINESS", priority: "WARNING" },
  SUBSCRIPTION_PURCHASED: { category: "PAYMENT", priority: "SUCCESS" },
  SUBSCRIPTION_UPGRADED: { category: "PAYMENT", priority: "SUCCESS" },
  SUBSCRIPTION_DOWNGRADED: { category: "PAYMENT", priority: "WARNING" },
  SUBSCRIPTION_RENEWED: { category: "PAYMENT", priority: "SUCCESS" },
  PAYMENT_SUCCEEDED: { category: "PAYMENT", priority: "SUCCESS" },
  PAYMENT_FAILED: { category: "PAYMENT", priority: "WARNING" },
  SUBSCRIPTION_CANCELED: { category: "PAYMENT", priority: "WARNING" },
  COMPANY_SUSPENDED: { category: "SECURITY", priority: "WARNING" },
  COMPANY_REACTIVATED: { category: "SECURITY", priority: "INFO" },
  WEBHOOK_FAILED: { category: "SYSTEM", priority: "ERROR" },
  SYSTEM_ERROR: { category: "SYSTEM", priority: "CRITICAL" },
};

const CATEGORY_ICON: Record<Category, IconName> = {
  BUSINESS: "briefcase-outline",
  PAYMENT: "card-outline",
  SYSTEM: "hardware-chip-outline",
  SECURITY: "shield-checkmark-outline",
  TENANT: "notifications-outline",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  INFO: "#2F9E8F",
  SUCCESS: colors.success,
  WARNING: colors.warning,
  ERROR: colors.danger,
  CRITICAL: "#B23A35",
};

// Direct icon/color per TenantNotificationType (backend's prisma/schema.prisma) — this table
// has no category tier of its own like PlatformEvent does, so each type maps straight to a
// visual instead of going through CATEGORY_ICON.
const TENANT_NOTIFICATION_META: Record<string, NotificationVisual> = {
  LEAD_CREATED: { icon: "person-add-outline", color: PRIORITY_COLOR.INFO },
  LEAD_HOT: { icon: "flame-outline", color: PRIORITY_COLOR.WARNING },
  LEAD_STATUS_CHANGED: { icon: "swap-horizontal-outline", color: PRIORITY_COLOR.INFO },
  APPOINTMENT_SCHEDULED: { icon: "calendar-outline", color: PRIORITY_COLOR.SUCCESS },
  TEAM_MEMBER_INVITED: { icon: "mail-outline", color: PRIORITY_COLOR.INFO },
  TEAM_MEMBER_REMOVED: { icon: "person-remove-outline", color: PRIORITY_COLOR.WARNING },
};

export interface NotificationVisual {
  icon: IconName;
  color: string;
}

export function getNotificationVisual(source: "platform" | "tenant", type: string): NotificationVisual {
  if (type === "CUSTOMER_REGISTERED_GROUP") {
    return { icon: "people-outline", color: PRIORITY_COLOR.SUCCESS };
  }
  if (source === "tenant") {
    return TENANT_NOTIFICATION_META[type] ?? { icon: CATEGORY_ICON.TENANT, color: colors.textMuted };
  }
  const meta = PLATFORM_EVENT_META[type];
  if (!meta) return { icon: "notifications-outline", color: colors.textMuted };
  return { icon: CATEGORY_ICON[meta.category], color: PRIORITY_COLOR[meta.priority] };
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}

export type DateGroupLabel = "Today" | "Yesterday" | "Older";

export function dateGroupLabel(iso: string): DateGroupLabel {
  const now = new Date();
  const date = new Date(iso);

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Older";
}

export interface GroupableNotification extends MobileNotification {
  read: boolean;
  memberIds?: string[];
}

const REGISTRATION_GROUP_TYPES = new Set(["COMPANY_REGISTERED", "USER_REGISTERED", "TRIAL_STARTED"]);
// registerAction (backend app/(auth)/actions.ts) emits all three events synchronously, one right
// after another, so a real triple is always milliseconds apart — this window is generous purely
// to tolerate clock/latency skew, not because a real gap that large is expected.
const REGISTRATION_GROUP_WINDOW_MS = 10 * 60 * 1000;

// Merges the three PlatformEvent rows one signup produces (COMPANY_REGISTERED, USER_REGISTERED,
// TRIAL_STARTED — see backend lib/platform-events/registry.ts) into a single "New customer
// registered" card. Matched by companyId + all three types present within the time window above;
// anything left over (a signup missing one of the three, or a non-registration event) passes
// through unchanged.
export function groupRegistrationEvents<T extends GroupableNotification>(items: T[]): T[] {
  const candidatesByCompany = new Map<string, T[]>();
  for (const item of items) {
    if (item.source !== "platform" || !item.companyId || !REGISTRATION_GROUP_TYPES.has(item.type)) continue;
    const list = candidatesByCompany.get(item.companyId) ?? [];
    list.push(item);
    candidatesByCompany.set(item.companyId, list);
  }

  const groups: T[] = [];
  const consumedIds = new Set<string>();

  for (const [companyId, candidates] of candidatesByCompany) {
    const byType = new Map<string, T>();
    for (const candidate of [...candidates].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (!byType.has(candidate.type)) byType.set(candidate.type, candidate);
    }

    const companyEvent = byType.get("COMPANY_REGISTERED");
    const userEvent = byType.get("USER_REGISTERED");
    const trialEvent = byType.get("TRIAL_STARTED");
    if (!companyEvent || !userEvent || !trialEvent) continue;

    const times = [companyEvent, userEvent, trialEvent].map((event) => new Date(event.createdAt).getTime());
    if (Math.max(...times) - Math.min(...times) > REGISTRATION_GROUP_WINDOW_MS) continue;

    const companyName = (companyEvent.metadata?.companyName as string | undefined) ?? "";
    const email = (userEvent.metadata?.email as string | undefined) ?? "";
    const latest = [companyEvent, userEvent, trialEvent].reduce((a, b) => (a.createdAt > b.createdAt ? a : b));

    groups.push({
      ...latest,
      id: `group:${companyId}:${companyEvent.id}`,
      type: "CUSTOMER_REGISTERED_GROUP",
      title: "New customer registered",
      body: `Company: ${companyName}\nUser: ${email}\nTrial started`,
      read: companyEvent.read && userEvent.read && trialEvent.read,
      memberIds: [companyEvent.id, userEvent.id, trialEvent.id],
    });
    consumedIds.add(companyEvent.id);
    consumedIds.add(userEvent.id);
    consumedIds.add(trialEvent.id);
  }

  if (groups.length === 0) return items;

  return [...items.filter((item) => !consumedIds.has(item.id)), ...groups].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function groupByDay<T extends { createdAt: string }>(items: T[]): { label: DateGroupLabel; items: T[] }[] {
  const groups: Record<DateGroupLabel, T[]> = { Today: [], Yesterday: [], Older: [] };
  for (const item of items) {
    groups[dateGroupLabel(item.createdAt)].push(item);
  }
  return (["Today", "Yesterday", "Older"] as const)
    .map((label) => ({ label, items: groups[label] }))
    .filter((group) => group.items.length > 0);
}
