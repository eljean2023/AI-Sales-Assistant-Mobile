export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
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
