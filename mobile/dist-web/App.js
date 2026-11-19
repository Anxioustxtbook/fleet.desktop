/* The app: the frame (header, menu, status bar) around whichever screen is open. */

import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession, useTheme } from './src/ui/session.js';
import { LookProvider, useLook } from './src/ui/look.js';
import { ToastProvider } from './src/ui/kit.js';
import Splash from './src/ui/Splash.js';
import Shell from './src/ui/Shell.js';
import ConnectHelp from './src/ui/ConnectHelp.js';
import { Card, Txt } from './src/ui/parts.js';
import Dashboard from './src/ui/screens/Dashboard.js';
import Home from './src/ui/screens/Home.js';
import { AppReady } from './src/ui/ready.js';
import Connect from './src/ui/screens/Connect.js';
import Review from './src/ui/screens/Review.js';
import Placeholder from './src/ui/screens/Placeholder.js';
import FuelScreen from './src/ui/screens/FuelScreen.js';
import CoopScreen from './src/ui/screens/CoopScreen.js';
import Overdue from './src/ui/screens/Overdue.js';
import ListScreen from './src/ui/screens/ListScreen.js';
import Files from './src/ui/screens/Files.js';
import Notifications from './src/ui/screens/Notifications.js';
import Pilot from './src/ui/screens/Pilot.js';
import Audit from './src/ui/screens/Audit.js';
import Analysis from './src/ui/screens/Analysis.js';
import Calendar from './src/ui/screens/Calendar.js';
import Performance from './src/ui/screens/Performance.js';
import Reports from './src/ui/screens/Reports.js';
import { isTable } from './src/ui/tables.js';

const SCREENS = { home: Home, dashboard: Dashboard, deskdash: Dashboard, connect: Connect, review: Review, pilot: Pilot, audit: Audit, analysis: Analysis, calendar: Calendar, performance: Performance, reports: Reports, overdue: Overdue, files: Files, notifs: Notifications };   // the tables use ListScreen

function Body() {
  const s = useSession(), t = useTheme();
  if (s.boot.phase === 'opening') return <View style={{ flex: 1, backgroundColor: t.bg }} />;      // the splash is drawn over this
  if (s.boot.phase === 'failed')
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: 'center' }}>
        <Card><Txt bold size={17}>The phone database could not be opened</Txt><Txt tone="dim" style={{ marginTop: 8 }}>{s.boot.message}</Txt></Card>
      </View>
    );
  const Screen = SCREENS[s.screen] || Placeholder;
  return (
    <Shell>
      {isTable(s.screen) ? (s.screen === 'fuel' ? <FuelScreen /> : s.screen === 'coop' ? <CoopScreen /> : <ListScreen id={s.screen} />) : <Screen />}
      <ConnectHelp />
    </Shell>
  );
}

/* the black logo splash covers the app until it is ready (the database is open and the look is loaded) */
function Root() {
  const s = useSession(), look = useLook(), [splash, setSplash] = useState(true);
  const done = useCallback(() => setSplash(false), []);
  const ready = s.boot.phase !== 'opening' && !!(look && look.ready);
  return (
    <AppReady.Provider value={!splash}>
      <View style={{ flex: 1 }}>
        {look && look.ready ? <Body /> : <View style={{ flex: 1, backgroundColor: '#000' }} />}
        {splash ? <Splash ready={ready} onDone={done} /> : null}
      </View>
    </AppReady.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LookProvider>
        <ToastProvider>
          <SessionProvider>
            <Root />
          </SessionProvider>
        </ToastProvider>
      </LookProvider>
    </SafeAreaProvider>
  );
}
