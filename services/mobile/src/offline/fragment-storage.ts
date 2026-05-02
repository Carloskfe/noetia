import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineFragment {
  localId: string;
  serverId?: string;
  bookId: string;
  text: string;
  chapterIndex: number;
  createdAt: number;
  synced: boolean;
  deleted?: boolean;
}

const FRAGMENTS_KEY = 'noetia_offline_fragments';

async function readAll(): Promise<OfflineFragment[]> {
  try {
    const raw = await AsyncStorage.getItem(FRAGMENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineFragment[];
  } catch {
    return [];
  }
}

async function writeAll(fragments: OfflineFragment[]): Promise<void> {
  await AsyncStorage.setItem(FRAGMENTS_KEY, JSON.stringify(fragments));
}

export async function saveFragment(fragment: OfflineFragment): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((f) => f.localId === fragment.localId);
  if (idx >= 0) {
    all[idx] = fragment;
  } else {
    all.push(fragment);
  }
  await writeAll(all);
}

export async function loadFragments(bookId?: string): Promise<OfflineFragment[]> {
  const all = await readAll();
  const visible = all.filter((f) => !f.deleted);
  if (!bookId) return visible;
  return visible.filter((f) => f.bookId === bookId);
}

export async function markFragmentSynced(localId: string, serverId: string): Promise<void> {
  const all = await readAll();
  const fragment = all.find((f) => f.localId === localId);
  if (fragment) {
    fragment.synced = true;
    fragment.serverId = serverId;
    await writeAll(all);
  }
}

export async function deleteFragment(localId: string): Promise<void> {
  const all = await readAll();
  const fragment = all.find((f) => f.localId === localId);
  if (fragment) {
    fragment.deleted = true;
    fragment.synced = false;
    await writeAll(all);
  }
}

export async function purgeFragment(localId: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((f) => f.localId !== localId));
}

export async function getUnsyncedFragments(): Promise<OfflineFragment[]> {
  const all = await readAll();
  return all.filter((f) => !f.synced);
}
