/* The session: opens the app once, keeps the few things every screen needs (connection, what is running, which
   screen is open), and runs the actions (pair, first copy, sync). Screens call these; they never talk to the
   database or the network themselves. Problems are shown in plain words, and "cannot reach the computer" always
   offers the help guide. */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Platform } from 'react-native';
import * as NotificationsApi from 'expo-notifications';
import { createPlatform } from '../platform.js';
import { createApp } from '../app.js';
import { barState, canSync } from './logic.js';
import { popHistory, pushHistory } from './nav.js';
import { useToast } from './kit.js';
import { useTheme as useLookTheme } from './look.js';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  normalizeNotificationSettings,
  refreshScheduledNotifications,
  requestNotificationPermission,
  sendTestNotification
} from './notifications.js';

const Session = createContext(null);
export const useSession = () => useContext(Session);
export const useTheme = useLookTheme;        // the colours now come from look.js (light, dark, or the phone's setting)

export function SessionProvider({ children }) {
  const app = useRef(null);
  const [boot, setBoot] = useState({ phase: 'opening' });          // opening | ready | failed
  const [status, setStatus] = useState(null);                      // what app.status() last said
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const notificationSettingsRef = useRef(DEFAULT_NOTIFICATION_SETTINGS);
  const reminderRefreshRef = useRef(Promise.resolve());
  const [ping, setPing] = useState('stopped');                     // connected | unreachable | not-paired | stopped
  const [busy, setBusy] = useState(null);                          // { text } while pairing, copying or syncing
  const [ask, setAsk] = useState(null);                            // 'approval' | 'clock': waiting for the owner at the computer
  const toast = useToast();                                          // short results ("Synced: sent 3, received 2") now show as a toast
  const [screen, setScreen] = useState('home');
  const [sheet, setSheet] = useState(null);                         // null | 'add' | 'menu'
  const [pages, setPages] = useState([]);                           // full pages on top of the screen: Account, Settings, forms...
  const [formRequest, setFormRequest] = useState(null);             // an entry form opened from the + sheet
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOn, setTourOn] = useState(false);                         // the Home tour
  const startTour = useCallback(() => setTourOn(true), []);
  const history = useRef([]);
  const screenRef = useRef('home'); screenRef.current = screen;

  const [version, setVersion] = useState(0);                       // goes up after every refresh, so screens read their lists again after a save
  const say = useCallback(text => { toast(text); }, [toast]);

  /* a problem, in the words the phone already made for it */
  const notify = useCallback((error, title) => {
    const buttons = error && error.code === 'unreachable'
      ? [{ text: 'Show me how', onPress: () => setHelpOpen(true) }, { text: 'OK' }]
      : [{ text: 'OK' }];
    Alert.alert(title || 'Something needs your attention', error && error.message ? error.message : String(error), buttons);
  }, []);

  const scheduleReminders = useCallback((targetApp, settings) => {
    const pending = reminderRefreshRef.current.catch(() => {}).then(() => refreshScheduledNotifications(targetApp, settings));
    reminderRefreshRef.current = pending;
    return pending;
  }, []);

  const refresh = useCallback(async () => {
    if (!app.current) return;
    const opened = app.current;
    setStatus(await opened.status());
    setVersion(v => v + 1);
    scheduleReminders(opened, notificationSettingsRef.current).catch(error => notify(error, 'Phone reminders could not be refreshed'));
  }, [notify, scheduleReminders]);

  const setNotificationSettingsPreference = useCallback(async value => {
    try {
      const next = normalizeNotificationSettings({ ...notificationSettingsRef.current, ...value });
      if (next.enabled && Platform.OS !== 'web' && !(await requestNotificationPermission())) {
        throw new Error('Allow FleetPilot notifications in your phone settings first.');
      }
      if (!app.current) throw new Error('FleetPilot is still opening. Try again in a moment.');
      await app.current.db.setMeta('notificationSettings', next);
      notificationSettingsRef.current = next;
      setNotificationSettings(next);
      await scheduleReminders(app.current, next);
    } catch (error) {
      notify(error, 'Notification settings could not be saved');
    }
  }, [notify, scheduleReminders]);

  const testNotification = useCallback(() => sendTestNotification(notificationSettingsRef.current), []);

  /* ---------- open once ---------- */
  useEffect(() => {
    let alive = true, subscription = null, notificationSubscription = null;
    (async () => {
      try {
        const opened = await createApp(createPlatform(), { onPingState: state => { if (alive) setPing(state); } });
        app.current = opened;
        const savedNotifications = normalizeNotificationSettings(await opened.db.getMeta('notificationSettings', DEFAULT_NOTIFICATION_SETTINGS));
        notificationSettingsRef.current = savedNotifications;
        setNotificationSettings(savedNotifications);
        await refresh();
        if (!alive) return;
        setBoot({ phase: 'ready' });
        if (AppState.currentState === 'active') opened.pinger.start();
        subscription = AppState.addEventListener('change', state => (state === 'active' ? opened.pinger.start() : opened.pinger.stop()));
        if (Platform.OS !== 'web') {
          notificationSubscription = NotificationsApi.addNotificationResponseReceivedListener(response => {
            const target = response.notification.request.content.data && response.notification.request.content.data.screen;
            if (target === 'rentals' || target === 'bookings') {
              history.current = pushHistory(history.current, screenRef.current, target);
              setScreen(target); setSheet(null); setPages([]);
            }
          });
          const lastResponse = await NotificationsApi.getLastNotificationResponseAsync();
          const target = lastResponse && lastResponse.notification.request.content.data && lastResponse.notification.request.content.data.screen;
          if (target === 'rentals' || target === 'bookings') {
            history.current = pushHistory(history.current, screenRef.current, target);
            setScreen(target); setSheet(null); setPages([]);
          }
        }
        opened.onOpen().then(refresh).catch(() => {});             // old green dots go, and the developer backup is checked; never holds the app up
      } catch (e) {
        if (alive) setBoot({ phase: 'failed', message: e && e.message ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
      if (subscription) subscription.remove();
      if (notificationSubscription) notificationSubscription.remove();
      if (app.current) app.current.pinger.stop();
    };
  }, [refresh]);

  /* ---------- where we are: screens, the back history, full pages, sheets ---------- */
  const go = useCallback((id, noHistory) => {
    history.current = pushHistory(history.current, screenRef.current, id, noHistory);
    setScreen(id); setSheet(null); setPages([]);
  }, []);
  const goBack = useCallback(() => {
    const out = popHistory(history.current);
    history.current = out.history; setScreen(out.screen); setSheet(null); setPages([]);
  }, []);
  const openPage = useCallback(page => setPages(p => [...p, page]), []);
  const closePage = useCallback(() => setPages(p => p.slice(0, -1)), []);
  const openSheet = useCallback(kind => setSheet(kind), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const openForm = useCallback(request => { setSheet(null); setFormRequest(request); }, []);
  const closeForm = useCallback(() => setFormRequest(null), []);

  /* the phone's Back button: close the sheet, then the page, then go back through the screens; Home is the end */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) { setSheet(null); return true; }
      if (pages.length) { setPages(p => p.slice(0, -1)); return true; }
      if (screen === 'analysis') { go('audit', true); return true; }          // Analysis lives inside the Audit
      if (screen !== 'home') { goBack(); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [screen, sheet, pages, go, goBack]);

  /* ---------- actions ---------- */
  const pairWith = useCallback(async ({ addresses, pin, desktopId }) => {
    setBusy({ text: 'Connecting...' });
    try {
      const done = await app.current.pairing.pair({ addresses, pin, desktopId, onWaiting: () => setAsk('approval') });
      await refresh();
      return { ok: true, ...done };
    } catch (e) {
      if (e.code === 'bad-pin') return { ok: false, tryAgain: true, message: e.message };
      notify(e, 'Pairing did not finish');
      return { ok: false };
    } finally { setAsk(null); setBusy(null); }
  }, [refresh, notify]);

  const firstCopy = useCallback(async ({ merge = false } = {}) => {
    setBusy({ text: 'Copying the ledger...' });
    try {
      const done = await app.current.engine.fullCopy({ merge, onProgress: p => setBusy({ text: `Copying ${p.done} of ${p.total}` }) });
      await refresh();
      say(done.totalsOk ? `Copied ${done.copied} records` : 'Copied, but some totals differ: see the Review list');
      return done;
    } catch (e) {
      if (e.code === 'not-empty') return { needsMergeChoice: true, message: e.message };
      notify(e, 'The first copy did not finish');
      await refresh();
      return null;
    } finally { setBusy(null); }
  }, [refresh, notify, say]);

  const sync = useCallback(async () => {
    if (!app.current) return null;
    setBusy({ text: 'Syncing...' });
    try {
      const done = await app.current.sync({
        onProgress: p => { setAsk(null); setBusy({ text: p.phase === 'push' ? `Sending ${p.done} of ${p.total}` : p.phase === 'pull' ? `Receiving ${p.done}` : 'Syncing...' }); },
        onStatus: s => { if (s.state === 'clock-pending') setAsk('clock'); }
      });
      await refresh();
      say(done.totalsOk ? `Synced: sent ${done.pushed}, received ${done.pulled}` : 'Synced, but some totals differ: see the Review list');
      return done;
    } catch (e) {
      notify(e, 'The sync did not finish');
      await refresh();
      return null;
    } finally { setAsk(null); setBusy(null); }
  }, [refresh, notify, say]);

  const unpair = useCallback(async () => {
    await app.current.pairing.unpair();
    await app.current.pinger.once();
    await refresh();
  }, [refresh]);

  const info = {
    paired: status ? status.paired : false,
    desktopName: status ? status.desktopName : null,
    needsFullCopy: status ? status.needsFullCopy : false,
    ping, busy, ask
  };

  return (
    <Session.Provider value={{
      boot, app: app.current, status, version, ping, busy, ask, flash: '', screen, sheet, pages, formRequest, helpOpen, tourOn, startTour, setTourOn,
      notificationSettings, setNotificationSettings: setNotificationSettingsPreference, testNotification,
      menuOpen: sheet === 'menu', bar: barState(info), canSync: canSync(info),
      go, goBack, openPage, closePage, openSheet, closeSheet, openForm, closeForm, setMenuOpen: v => setSheet(v ? 'menu' : null),
      setHelpOpen, refresh, say, notify, pairWith, firstCopy, sync, unpair
    }}>
      {children}
    </Session.Provider>
  );
}
