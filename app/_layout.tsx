import { Stack } from "expo-router";

import { AuthProvider } from "../src/auth/AuthContext";
import { NotificationProvider } from "../src/notifications/NotificationContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NotificationProvider>
    </AuthProvider>
  );
}
