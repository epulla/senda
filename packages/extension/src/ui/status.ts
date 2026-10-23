import type { ConnectionStatus } from '@/src/bg/state';

export const STATUS: Record<ConnectionStatus, { label: string; dot: string }> = {
  connected: { label: 'Connected to Senda on this computer', dot: 'bg-primary' },
  disconnected: { label: 'Not connected. Is your AI app running with Senda?', dot: 'bg-muted' },
  invalid_token: { label: 'The code is wrong. Paste it again.', dot: 'bg-error' },
};
