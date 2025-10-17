export interface User {
  uid: string;
  name: string;
}

export interface Policy {
  pid: string;
  tags: string[];
  users: User[];
  type: string;
  action: string;
  cronTime: string;
  duration: number;
  disabled: boolean;
  hitCount: number;
  activatedTime: number | null;
  expire: number | null;
  idleTs: number | null;
}

export interface PoliciesResponse {
  policies: Policy[];
  serverTime: string;
  timezone: string;
}

export interface HistoryEntry {
  timestamp: string;
  policy_id: string;
  tags: string[];
  action: string;
  duration_minutes: number;
  reason?: string;
  expires_at: string;
}

export interface SetupConfig {
  setupComplete: boolean;
  adminEmail: string;
  firewallConfigured: boolean;
  emailConfigured: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: AuthUser | null;
  setup: SetupConfig;
  oauthConfigured: boolean;
}
