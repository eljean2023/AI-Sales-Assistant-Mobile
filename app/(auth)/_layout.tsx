import { Redirect, Slot } from "expo-router";

import { useAuth } from "../../src/auth/useAuth";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Redirect href="/home" />;

  return <Slot />;
}
