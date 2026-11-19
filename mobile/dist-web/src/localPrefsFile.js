/* The phone's file for localPrefs.js: one JSON file in the app's private folder (not the database, not synced, not in the backup). */
import { Platform } from 'react-native';

const webStorage = () => {
  if (!globalThis.localStorage) throw new Error('Local preferences are unavailable in this browser.');
  return globalThis.localStorage;
};

export const prefsFile = {
  read: async () => {
    if (Platform.OS === 'web') return webStorage().getItem('fleetpilot-local-settings') || '';
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.document, 'fleetpilot-local-settings.json');
    return f.exists ? f.text() : '';
  },
  write: async text => {
    if (Platform.OS === 'web') {
      webStorage().setItem('fleetpilot-local-settings', text);
      return;
    }
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.document, 'fleetpilot-local-settings.json');
    if (!f.exists) f.create();
    f.write(text);
  }
};
