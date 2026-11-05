import { ErrorCode } from '@senda/protocol';
import { CommandError } from '../commands/shared';

export async function fetchRecipe(url: string): Promise<unknown> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error();
    const response = await fetch(parsed);
    if (!response.ok) throw new Error();
    const limit = 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit) throw new Error();
    if (!response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CommandError(ErrorCode.INVALID_PARAMS, 'Recipe URL must return valid JSON over HTTPS (maximum 1 MB).');
  }
}
