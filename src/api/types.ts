export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthTokens {
  user: UserProfile;
}

export interface RegisterDeviceRequest {
  deviceId: string;
  fcmToken: string;
  platform: "ios" | "android";
  appVersion: string;
}

export interface MobileNotification {
  id: string;
  source: "platform" | "tenant";
  type: string;
  title: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
  companyId: string | null;
  metadata: Record<string, unknown> | null;
}
