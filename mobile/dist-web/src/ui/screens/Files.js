/* Settings combines appearance preferences with File & Backup actions. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Card, Txt } from '../parts.js';
import { lastSyncText } from '../logic.js';
import { useSession, useTheme } from '../session.js';
import { useLook } from '../look.js';
import { RADIUS } from '../theme.js';
import CsvExport from '../CsvExport.js';
import ExcelExport from '../ExcelExport.js';
import PortableFilesPanel from '../PortableFilesPanel.js';
import Logo from '../Logo.js';

function Entry({ title, line, badge, onPress }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ marginBottom: 12, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ backgroundColor: t.panel, borderColor: t.line, borderWidth: 1, borderRadius: RADIUS.card, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Txt bold size={16.5}>{title}</Txt>
          {!!line && <Txt tone="dim" size={13.5} style={{ marginTop: 2 }}>{line}</Txt>}
        </View>
        {badge > 0 && <View style={{ backgroundColor: t.red, borderRadius: 10, minWidth: 22, paddingHorizontal: 6, height: 22, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>{badge}</Text></View>}
        <Text style={{ color: t.inkFaint, fontSize: 24, lineHeight: 26 }}>›</Text>
      </View>
    </Pressable>
  );
}

const dayText = iso => { if (!iso) return 'No backup yet'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? 'No backup yet' : lastSyncText(iso).replace('Last sync', 'Last backup'); };
const APPEARANCES = [
  { value: 'auto', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
];

function DisplayScale({ value, onChange }) {
  const t = useTheme(), [draft, setDraft] = useState(value), width = useRef(0), current = useRef(value);
  useEffect(() => { current.current = value; setDraft(value); }, [value]);
  const update = event => {
    if (!width.current) return;
    const fraction = Math.max(0, Math.min(1, (event.nativeEvent.locationX - 14) / Math.max(1, width.current - 28)));
    const next = Number((Math.round((0.6 + fraction * 0.4) * 50) / 50).toFixed(2));
    current.current = next;
    setDraft(next);
  };
  const accessibilityChange = action => {
    const direction = action.nativeEvent.actionName === 'increment' ? 1 : -1;
    const next = Math.max(0.6, Math.min(1, Number((current.current + direction * 0.02).toFixed(2))));
    current.current = next;
    setDraft(next);
    onChange(next);
  };
  const fraction = (draft - 0.6) / 0.4;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 }}>
        <Txt bold size={14}>Display size</Txt><Txt mono size={13}>{draft.toFixed(2)}</Txt>
      </View>
      <View accessibilityRole="adjustable" accessibilityLabel="Display size" accessibilityValue={{ min: 0.6, max: 1, now: draft }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={accessibilityChange}
        onLayout={event => { width.current = event.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={update} onResponderMove={update} onResponderRelease={() => onChange(current.current)}
        onResponderTerminate={() => onChange(current.current)} style={{ height: 34, justifyContent: 'center', marginTop: 4 }}>
        <View style={{ position: 'absolute', left: 14, right: 14, height: 4, borderRadius: 2, backgroundColor: t.panel3 }} />
        <View style={{ position: 'absolute', left: 14, width: Math.max(0, width.current - 28) * fraction, height: 4, borderRadius: 2, backgroundColor: t.amber }} />
        <View style={{ position: 'absolute', left: 14 + Math.max(0, width.current - 28) * fraction - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: t.amber, borderWidth: 3, borderColor: t.panel }} />
      </View>
      <Txt tone="dim" size={12}>Smaller shows more on the screen. Larger is easier to read. Default 0.80.</Txt>
      <Button label="Reset to default" onPress={() => onChange(0.8)} style={{ marginTop: 10 }} />
    </View>
  );
}

export default function Files() {
  const s = useSession(), t = useTheme(), look = useLook(), st = s.status;
  const [backupAt, setBackupAt] = useState(null), [running, setRunning] = useState(false), [refreshing, setRefreshing] = useState(false);
  const read = useCallback(async () => { setBackupAt(await s.app.db.getMeta('devBackupAt', null)); }, [s.app]);
  useEffect(() => { read().catch(error => s.notify(error, 'Backup information could not be loaded')); }, [read, s.notify]);

  const backUpNow = async () => {
    setRunning(true);
    try {
      const done = await s.app.backup.refresh();
      await read();
      if (done && done.ok === false) Alert.alert('The backup did not finish', `${done.error || 'Something went wrong'}\n\nThe older backup was kept.`);
      else s.say('Backup done');
    } catch (e) { s.notify(e, 'The backup did not finish'); }
    finally { setRunning(false); }
  };
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await s.refresh(); await read(); }
    catch (e) { s.notify(e, 'File & Backup could not be refreshed'); }
    finally { setRefreshing(false); }
  }, [s.refresh, s.notify, read]);

  const connected = !!(st && st.paired && s.ping === 'connected');
  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.amber} colors={[t.amber]} />}
      contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      <Card>
        <Txt bold size={16.5}>Settings</Txt>
        <Txt tone="dim" size={13.5} style={{ marginTop: 4 }}>Customize how FleetPilot looks on this phone.</Txt>
        <Txt tone="faint" size={12.5} style={{ marginTop: 12, marginBottom: 6 }}>APPEARANCE</Txt>
        <View style={{ flexDirection: 'row' }}>
          {APPEARANCES.map(option => {
            const selected = look.themeChoice === option.value;
            return (
              <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => look.setTheme(option.value)}
                style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: option.value === 'dark' ? 0 : 7, borderRadius: RADIUS.button, borderWidth: 1, borderColor: selected ? t.green : t.line, backgroundColor: selected ? t.panel2 : t.panel }}>
                <Txt tone={selected ? 'ok' : 'dim'} bold={selected} size={13.5}>{option.label}</Txt>
              </Pressable>
            );
          })}
        </View>
        <DisplayScale value={look.z} onChange={look.setZoom} />
      </Card>

      <Card>
        <Txt bold size={16.5}>Connect &amp; Sync</Txt>
        {connected && <Txt tone="ok" bold size={13.5} style={{ marginTop: 4 }}>Connected to {st.desktopName || 'the computer'} · {lastSyncText(st.lastSyncAt)}</Txt>}
        {st && st.paired && !st.needsFullCopy && (
          <Button label="Sync now" kind="go" disabled={!s.canSync} onPress={s.sync} style={{ minHeight: 54, marginTop: 12 }} />
        )}
        <Button
          label={st && st.paired ? (st.needsFullCopy ? 'Finish first copy' : 'Connection settings') : 'Connect to desktop'}
          kind={!st || !st.paired || st.needsFullCopy ? 'go' : 'normal'}
          onPress={() => s.go('connect')}
          style={{ minHeight: 54, marginTop: st && st.paired && !st.needsFullCopy ? 8 : 12 }}
        />
      </Card>

      <Entry title="Review list" line={st && st.reviewOpen ? 'Things the computer or phone want you to look at' : 'Nothing to look at'} badge={st ? st.reviewOpen : 0} onPress={() => s.go('review')} />
      <ExcelExport />
      <CsvExport />
      <PortableFilesPanel showImport={false} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Logo size={36} />
          <Txt bold size={16.5} style={{ marginLeft: 8 }}>Backup</Txt>
        </View>
        <Txt tone="dim" size={13.5} style={{ marginTop: 2 }}>{s.app.isWeb
          ? 'The phone-local safety backup is available on Android. Use Phone archive above for a browser download.'
          : "A full safety copy of the phone's records, kept on this phone and refreshed automatically every 14 days."}</Txt>
        <Txt tone="faint" size={13.5} style={{ marginTop: 6, marginBottom: 10 }}>{dayText(backupAt)}</Txt>
        <Button label={running ? 'Backing up...' : s.app.isWeb ? 'Available on Android' : 'Back up now'} disabled={running || s.app.isWeb} onPress={backUpNow} />
      </Card>
    </ScrollView>
  );
}
