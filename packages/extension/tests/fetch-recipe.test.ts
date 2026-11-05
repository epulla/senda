import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@senda/protocol';
import { fetchRecipe } from '../src/bg/adapters/fetch';

describe('fetchRecipe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects streamed bodies larger than 1 MB', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
        controller.enqueue(new Uint8Array(1));
      },
    }))));
    await expect(fetchRecipe('https://example.com/template.json')).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMS });
  });
});
