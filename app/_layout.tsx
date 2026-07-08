import { Stack } from "expo-router";

import { AuthProvider } from "../src/auth/AuthContext";
import { NotificationCenterProvider } from "../src/notifications/NotificationCenterContext";
import { NotificationProvider } from "../src/notifications/NotificationContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <NotificationCenterProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </NotificationCenterProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
