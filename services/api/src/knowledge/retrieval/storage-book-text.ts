import { StorageService } from '../../storage/storage.service';
import { BookTextPort } from './retrieval.types';
import { markOwnedBytes } from './s2-verification.service';

/**
 * Runtime S2 text adapter (§9.5): the existing `StorageService` reading the private `books` bucket, byte-exact.
 * Each read returns a freshly concatenated buffer that nothing else references, so it is marked as transferable to the
 * S2 worker without a copy (PO-045); pooled small buffers are not marked (`markOwnedBytes` checks) and get copied.
 */
export class StorageBookText implements BookTextPort {
  constructor(private readonly storage: StorageService) {}

  async read(textFileKey: string): Promise<Uint8Array> {
    const bytes = await this.storage.getBytes(textFileKey, 'books');
    markOwnedBytes(bytes);
    return bytes;
  }
}
