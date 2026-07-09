import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { isAxiosError } from "axios";

import { useAuth } from "../../src/auth/useAuth";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Logo } from "../../src/components/ui/Logo";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";
import { colors } from "../../src/theme/colors";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      // A missing/unreachable API_BASE_URL or a dropped connection never got a response from
      // the server at all, so it is not the same failure as the server actually rejecting the
      // credentials (401) — conflating the two here is what made a pure connectivity
      // misconfiguration look identical to "wrong password" during setup.
      if (isAxiosError(err) && !err.response) {
        setError("Can't reach the server. Check your connection and try again.");
      } else {
        setError("Invalid email or password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.wrapper}>
        <Card style={styles.card}>
          <View style={styles.brand}>
            <Logo size={64} />
            <Text style={styles.title}>AI Sales Assistant</Text>
            <Text style={styles.subtitle}>Sign in to view your notifications</Text>
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="you@company.com"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Log in" onPress={handleSubmit} loading={submitting} disabled={!email || !password} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: "10%",
  },
  card: {
    paddingVertical: 32,
  },
  brand: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
});
