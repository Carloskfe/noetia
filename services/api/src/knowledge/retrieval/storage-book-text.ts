import { StorageService } from '../../storage/storage.service';
import { BookTextPort } from './retrieval.types';

/** Runtime S2 text adapter (§9.5): the existing `StorageService` reading the private `books` bucket, byte-exact. */
export class StorageBookText implements BookTextPort {
  constructor(private readonly storage: StorageService) {}

  read(textFileKey: string): Promise<Uint8Array> {
    return this.storage.getBytes(textFileKey, 'books');
  }
}
