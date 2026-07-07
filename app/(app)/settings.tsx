import { Text } from "react-native";

import { useAuth } from "../../src/auth/useAuth";
import { Button } from "../../src/components/ui/Button";
import { Screen } from "../../src/components/ui/Screen";
import { ToggleRow } from "../../src/components/ui/ToggleRow";
import { useNotifications } from "../../src/notifications/NotificationContext";

export default function SettingsScreen() {
  const { logout } = useAuth();
  const { notificationsEnabled, setNotificationsEnabled } = useNotifications();

  const handleLogout = async () => {
    // Unregister this device first so the backend receives the request
    // while the session's access token is still valid.
    if (notificationsEnabled) {
      await setNotificationsEnabled(false);
    }
    await logout();
  };

  return (
    <Screen>
      <Text style={{ color: "#F5F7FA", fontSize: 22, fontWeight: "700", marginBottom: 24 }}>Settings</Text>

      <ToggleRow
        label="Push notifications"
        description="Receive real-time alerts from AI Sales Assistant"
        value={notificationsEnabled}
        onValueChange={setNotificationsEnabled}
      />

      <Button label="Log out" onPress={handleLogout} />
    </Screen>
  );
}
