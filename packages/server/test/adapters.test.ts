import { describe, expect, it } from 'vitest';
import { errorText, syncAdapterTools } from '../src/index.js';

const summary: any = {
  id: 'example', name: 'Example', version: '1.0.0', source: 'local', mode: 'read', sites: ['https://example.com/*'], status: 'active',
  tools: [{ name: 'lookup', description: 'Find item', effect: 'read', params: { query: { type: 'string', description: 'Search query', required: true } } }],
};

describe('adapter MCP tools', () => {
  it('adds, updates, and removes dynamic tools; compact mode registers none', () => {
    const tools = new Map<string, any>();
    const mcp = { registerTool(name: string, config: any, callback: any) { const entry = { config, callback, updates: [] as any[], removed: false, update(value: any) { this.updates.push(value); }, remove() { this.removed = true; } }; tools.set(name, entry); return entry; } };
    const registered = new Map<string, any>();
    syncAdapterTools(mcp, [summary], registered, () => 'ok');
    expect(registered.has('example__lookup')).toBe(true);
    syncAdapterTools(mcp, [{ ...summary, name: 'Updated' }], registered, () => 'ok');
    expect(tools.get('example__lookup').updates).toHaveLength(1);
    syncAdapterTools(mcp, [], registered, () => 'ok');
    expect(tools.get('example__lookup').removed).toBe(true);
    const compact = new Map();
    syncAdapterTools(mcp, [summary], compact, () => 'ok', true);
    expect(compact.size).toBe(0);
  });

  it('includes adapter repair data in tool errors', () => {
    expect(errorText({ code: 'ADAPTER_BROKEN' as any, message: 'Recipe failed', data: { repair: 'check selector' } })).toBe('ADAPTER_BROKEN: Recipe failed\n{"repair":"check selector"}');
  });
});
