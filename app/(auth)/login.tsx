import { useState } from "react";
import { Text } from "react-native";
import { isAxiosError } from "axios";

import { useAuth } from "../../src/auth/useAuth";
import { Button } from "../../src/components/ui/Button";
import { Screen } from "../../src/components/ui/Screen";
import { TextField } from "../../src/components/ui/TextField";

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
      <Text style={{ color: "#F5F7FA", fontSize: 24, fontWeight: "700", marginBottom: 32 }}>
        AI Sales Assistant
      </Text>
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
      {error ? <Text style={{ color: "#FF6B6B", marginBottom: 16 }}>{error}</Text> : null}
      <Button label="Log in" onPress={handleSubmit} loading={submitting} disabled={!email || !password} />
    </Screen>
  );
}
