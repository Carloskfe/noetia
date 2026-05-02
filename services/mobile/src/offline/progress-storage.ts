import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  phraseIndex: number;
  updatedAt: number;
  synced: boolean;
}

const PROGRESS_KEY = (bookId: string) => `noetia_progress_${bookId}`;
const UNSYNCED_PROGRESS_KEY = 'noetia_unsynced_progress';

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY(progress.bookId), JSON.stringify(progress));
  if (!progress.synced) {
    const ids = await getUnsyncedProgressIds();
    if (!ids.includes(progress.bookId)) {
      await AsyncStorage.setItem(UNSYNCED_PROGRESS_KEY, JSON.stringify([...ids, progress.bookId]));
    }
  }
}

export async function loadProgress(bookId: string): Promise<ReadingProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY(bookId));
    if (!raw) return null;
    return JSON.parse(raw) as ReadingProgress;
  } catch {
    return null;
  }
}

export async function markProgressSynced(bookId: string): Promise<void> {
  const progress = await loadProgress(bookId);
  if (progress) {
    progress.synced = true;
    await AsyncStorage.setItem(PROGRESS_KEY(bookId), JSON.stringify(progress));
  }
  const ids = await getUnsyncedProgressIds();
  await AsyncStorage.setItem(
    UNSYNCED_PROGRESS_KEY,
    JSON.stringify(ids.filter((id) => id !== bookId)),
  );
}

async function getUnsyncedProgressIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(UNSYNCED_PROGRESS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function getUnsyncedProgress(): Promise<ReadingProgress[]> {
  const ids = await getUnsyncedProgressIds();
  const results: ReadingProgress[] = [];
  for (const id of ids) {
    const p = await loadProgress(id);
    if (p) results.push(p);
  }
  return results;
}
