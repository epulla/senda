import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@senda/protocol';
import { fetchTemplate } from '../src/bg/adapters/templates';

describe('fetchTemplate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects streamed bodies larger than 1 MB', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
        controller.enqueue(new Uint8Array(1));
      },
    }))));
    await expect(fetchTemplate('https://example.com/template.json')).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMS });
  });
});
