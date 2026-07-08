import { useState } from "react";
import { ScrollView, Text } from "react-native";

import { sendTestPush } from "../../src/api/devices.api";
import { useAuth } from "../../src/auth/useAuth";
import { Button } from "../../src/components/ui/Button";
import { Screen } from "../../src/components/ui/Screen";
import { ToggleRow } from "../../src/components/ui/ToggleRow";
import { useNotifications } from "../../src/notifications/NotificationContext";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { notificationsEnabled, setNotificationsEnabled } = useNotifications();
  const [testPushResult, setTestPushResult] = useState<string | null>(null);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  const handleLogout = async () => {
    // Unregister this device first so the backend receives the request
    // while the session's access token is still valid.
    if (notificationsEnabled) {
      await setNotificationsEnabled(false);
    }
    await logout();
  };

  // TEMPORARY — debug button for the FIREBASE_PRIVATE_KEY rotation investigation. Remove this
  // handler, the button below, and sendTestPush() once push is confirmed working.
  const handleSendTestPush = async () => {
    setIsSendingTestPush(true);
    setTestPushResult(null);
    try {
      const data = await sendTestPush();
      setTestPushResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      const data = err?.response?.data;
      setTestPushResult(
        `HTTP ${err?.response?.status ?? "?"}\n${data ? JSON.stringify(data, null, 2) : String(err)}`,
      );
    } finally {
      setIsSendingTestPush(false);
    }
  };

  return (
    <Screen>
      <ScrollView>
        <Text style={{ color: "#F5F7FA", fontSize: 22, fontWeight: "700", marginBottom: 24 }}>Settings</Text>

        <ToggleRow
          label="Push notifications"
          description="Receive real-time alerts from AI Sales Assistant"
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />

        <Button label="Log out" onPress={handleLogout} />

        <Text style={{ color: "#8B96A8", fontSize: 13, marginTop: 32, marginBottom: 8 }}>
          Debug (temporary)
        </Text>
        <Button label="Send Test Push" onPress={handleSendTestPush} loading={isSendingTestPush} />
        {testPushResult && (
          <Text style={{ color: "#F5F7FA", fontSize: 12, fontFamily: "monospace", marginTop: 12 }}>
            {testPushResult}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
