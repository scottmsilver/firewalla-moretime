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
