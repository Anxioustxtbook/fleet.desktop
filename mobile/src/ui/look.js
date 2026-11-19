/* The look the whole app shares: which palette (light, dark or the phone's setting), the display size, the number font,
   and the phone-only settings they come from. Wrap the app in <LookProvider>. Screens call useTheme(), useZ() or useUI(). */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { createPrefs, cleanPrefs } from '../localPrefs.js';
import { prefsFile } from '../localPrefsFile.js';
import { FONT_MONO, LIGHT, MONO, paletteFor } from './theme.js';
import { DEFAULT_Z, MIN_TAP, scaled, tapSize } from './scale.js';

const Look = createContext(null);
const cleanPhotosOf = p => (p && typeof p === 'object' ? p : {});

export function LookProvider({ children }) {
  const phone = useColorScheme();
  const prefsApi = useMemo(() => createPrefs(prefsFile), []);
  const [prefs, setPrefs] = useState(() => cleanPrefs(null));
  const [loaded, setLoaded] = useState(false);
  const [fontsReady, fontError] = useFonts({
    [FONT_MONO.regular]: require('../../assets/fonts/JetBrainsMono_500Medium.ttf'),
    [FONT_MONO.bold]: require('../../assets/fonts/JetBrainsMono_700Bold.ttf')
  });

  useEffect(() => { let off = false; prefsApi.load().then(p => { if (!off) { setPrefs(p); setLoaded(true); } }); return () => { off = true; }; }, [prefsApi]);

  const save = useCallback(patch => { setPrefs(prev => cleanPrefs({ ...prev, ...patch })); return prefsApi.set(patch); }, [prefsApi]);

  const value = useMemo(() => ({
    t: paletteFor(phone, prefs.theme), z: prefs.zoom, themeChoice: prefs.theme, recordsView: prefs.recordsView,
    monoReady: !!fontsReady && !fontError, ready: loaded && (fontsReady || !!fontError),
    prefs, savePrefs: save,
    setTheme: v => save({ theme: v }), setZoom: v => save({ zoom: v }), previewZoom: v => setPrefs(prev => cleanPrefs({ ...prev, zoom: v })),
    setRecordsView: v => save({ recordsView: v }), setTourDone: v => save({ tourDone: !!v }),
    setGuidanceEnabled: v => save({ guidanceEnabled: !!v }),
    setNotes: notes => save({ notes: typeof notes === 'string' ? notes.slice(0, 2000) : '' }),
    setFloatingAddEnabled: v => save({ floatingAddEnabled: !!v }),
    setFloatingAddCorner: v => save({ floatingAddCorner: v }),
    setProfile: profile => save({ profile: { ...prefs.profile, ...profile } }),
    setPhoto: (key, uri) => save({ photos: { ...cleanPhotosOf(prefs.photos), [key]: uri } }),
    clearPhoto: key => { const p = { ...cleanPhotosOf(prefs.photos) }; delete p[key]; return save({ photos: p }); }
  }), [phone, prefs, fontsReady, fontError, loaded, save]);

  return <Look.Provider value={value}>{children}</Look.Provider>;
}

export const useLook = () => useContext(Look);
export const useTheme = () => { const l = useContext(Look); return l ? l.t : LIGHT; };
export const useZ = () => { const l = useContext(Look); return l ? l.z : DEFAULT_Z; };

/* everything a building block needs: the colours, a size scaler s(n), and the number font */
export function useUI() {
  const l = useContext(Look), z = l ? l.z : DEFAULT_Z, ready = l ? l.monoReady : false;
  return {
    t: l ? l.t : LIGHT, z, s: n => scaled(n, z), tap: n => tapSize(n, z),
    mono: bold => (ready ? (bold ? FONT_MONO.bold : FONT_MONO.regular) : MONO)
  };
}
