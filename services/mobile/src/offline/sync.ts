import {
  getUnsyncedFragments,
  markFragmentSynced,
  purgeFragment,
} from './fragment-storage';
import { getUnsyncedProgress, markProgressSynced } from './progress-storage';

export interface SyncClient {
  createFragment(payload: {
    bookId: string;
    text: string;
    chapterIndex: number;
    createdAt: number;
  }): Promise<{ id: string }>;
  deleteFragment(serverId: string): Promise<void>;
  updateProgress(payload: {
    bookId: string;
    chapterIndex: number;
    phraseIndex: number;
    updatedAt: number;
  }): Promise<void>;
}

export interface SyncResult {
  fragmentsSynced: number;
  progressSynced: number;
  errors: string[];
}

export async function syncOfflineData(client: SyncClient): Promise<SyncResult> {
  const result: SyncResult = { fragmentsSynced: 0, progressSynced: 0, errors: [] };

  const fragments = await getUnsyncedFragments();
  for (const fragment of fragments) {
    try {
      if (fragment.deleted) {
        if (fragment.serverId) {
          await client.deleteFragment(fragment.serverId);
        }
        await purgeFragment(fragment.localId);
      } else {
        const { id } = await client.createFragment({
          bookId: fragment.bookId,
          text: fragment.text,
          chapterIndex: fragment.chapterIndex,
          createdAt: fragment.createdAt,
        });
        await markFragmentSynced(fragment.localId, id);
        result.fragmentsSynced++;
      }
    } catch (e) {
      result.errors.push(`fragment ${fragment.localId}: ${(e as Error).message}`);
    }
  }

  const progressItems = await getUnsyncedProgress();
  for (const progress of progressItems) {
    try {
      await client.updateProgress({
        bookId: progress.bookId,
        chapterIndex: progress.chapterIndex,
        phraseIndex: progress.phraseIndex,
        updatedAt: progress.updatedAt,
      });
      await markProgressSynced(progress.bookId);
      result.progressSynced++;
    } catch (e) {
      result.errors.push(`progress ${progress.bookId}: ${(e as Error).message}`);
    }
  }

  return result;
}
