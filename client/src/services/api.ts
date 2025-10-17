import { Policy, HistoryEntry, PoliciesResponse } from '../types';

export const api = {
  async getPolicies(): Promise<PoliciesResponse> {
    const response = await fetch('/api/policies');
    if (!response.ok) throw new Error('Failed to fetch policies');
    const data = await response.json();
    return { policies: data.policies, serverTime: data.serverTime, timezone: data.timezone };
  },

  async pausePolicy(pid: string, minutes: number, reason: string): Promise<{ expiresAt: string }> {
    const response = await fetch(`/api/policies/${pid}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes, reason }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to pause policy');
    }
    return response.json();
  },

  async enablePolicy(pid: string): Promise<void> {
    const response = await fetch(`/api/policies/${pid}/enable`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to enable policy');
  },

  async getHistory(): Promise<HistoryEntry[]> {
    const response = await fetch('/api/history');
    if (!response.ok) throw new Error('Failed to fetch history');
    const data = await response.json();
    return data.history;
  },
};
