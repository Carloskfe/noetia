import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'noetia_tour_dismissed';

export async function isTourDismissed(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEY);
  return val === 'true';
}

export async function dismissTour(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}

export async function resetTour(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
