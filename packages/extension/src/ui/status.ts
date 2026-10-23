import type { ConnectionStatus } from '@/src/bg/state';

export const STATUS_DOT: Record<ConnectionStatus, string> = {
  connected: 'bg-primary',
  disconnected: 'bg-muted',
  invalid_token: 'bg-error',
};
