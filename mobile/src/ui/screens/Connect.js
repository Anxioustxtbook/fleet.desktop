/* Connect to desktop. One screen, three situations:
   - not paired: scan the QR code on the computer, or type its address and PIN (the camera may be refused);
   - paired but the first copy is not done: copy the whole ledger across;
   - connected: sync, the guide, and forgetting the computer.
   The "?" opens the guide of the four ways to put both on the same network. */

import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, Txt } from '../parts.js';
import { useSession, useTheme } from '../session.js';
import Skeleton from '../Skeleton.js';
import { parseQr } from '../../sync/pairing.js';
import { DEFAULT_PORT } from '../../config.js';
import { lastSyncText } from '../logic.js';
import { MONO } from '../theme.js';

function HelpButton() {
  const s = useSession(), t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="How do I connect?" onPress={() => s.setHelpOpen(true)} hitSlop={8}
      style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: t.line, backgroundColor: t.panel2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>?</Text>
    </Pressable>
  );
}

function Input({ style, ...props }) {
  const t = useTheme();
  return (
    <TextInput placeholderTextColor={t.inkFaint} autoCapitalize="none" autoCorrect={false}
      style={[{ borderWidth: 1, borderColor: t.line, backgroundColor: t.panel, color: t.ink, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 }, style]} {...props} />
  );
}

/* ---------- not paired ---------- */
function PairForm() {
  const s = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [problem, setProblem] = useState('');
  const handed = useRef(false);                                              // one scan is handed over once, not ten times a second

  const submit = async details => {
    setProblem('');
    const result = await s.pairWith(details);
    if (result.tryAgain) setProblem(result.message);                         // a wrong PIN: type it again
  };

  const onScan = ({ data }) => {
    if (handed.current) return;
    let qr;
    try { qr = parseQr(data); } catch (e) { setProblem(e.message); return; }
    handed.current = true;
    setScanning(false);
    submit({ addresses: qr.addresses, pin: qr.pin, desktopId: qr.desktopId }).finally(() => { handed.current = false; });
  };

  const startScan = async () => {
    setProblem('');
    const answer = permission && permission.granted ? permission : await requestPermission();
    if (answer && answer.granted) setScanning(true);
    else setProblem('The camera is not allowed. Type the address and the PIN shown on the computer instead.');
  };

  const connectTyped = () => {
    const addresses = address.split(/[\s,;]+/).filter(Boolean).map(a => (a.includes(':') ? a : `${a}:${DEFAULT_PORT}`));
    if (!addresses.length) { setProblem('Type the address shown on the computer.'); return; }
    if (!/^\d{4,8}$/.test(pin.trim())) { setProblem('Type the PIN shown on the computer.'); return; }
    submit({ addresses, pin: pin.trim(), desktopId: null });
  };

  const waiting = !!s.busy;
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Txt bold size={17} style={{ flex: 1 }}>Connect to the computer</Txt>
          <HelpButton />
        </View>
        <Txt tone="dim">On the computer, open Connect phone. Then scan the code shown there. Both must be on the same network.</Txt>
        {scanning ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ height: 300, borderRadius: 10, overflow: 'hidden' }}>
              <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
            </View>
            <Button label="Cancel" onPress={() => setScanning(false)} style={{ marginTop: 10 }} />
          </View>
        ) : (
          <Button label="Scan the code" kind="go" disabled={waiting} onPress={startScan} style={{ marginTop: 12 }} />
        )}
      </Card>

      <Card>
        <Txt bold size={16} style={{ marginBottom: 8 }}>Or type what the computer shows</Txt>
        <Input placeholder="Address, for example 192.168.1.20" value={address} onChangeText={setAddress} editable={!waiting} keyboardType="url" />
        <Input placeholder="PIN" value={pin} onChangeText={setPin} editable={!waiting} keyboardType="number-pad" maxLength={8}
          style={{ marginTop: 10, fontFamily: MONO, fontSize: 22, letterSpacing: 4 }} />
        <Button label="Connect" disabled={waiting} onPress={connectTyped} style={{ marginTop: 12 }} />
      </Card>

      {s.ask === 'approval' && (
        <Card><Txt bold tone="amber">Now approve this phone on the computer.</Txt><Txt tone="dim" style={{ marginTop: 4 }}>The phone is waiting. This screen goes on by itself.</Txt></Card>
      )}
      {!!problem && <Card><Txt tone="bad">{problem}</Txt></Card>}
    </ScrollView>
  );
}

/* ---------- paired, first copy not done ---------- */
function FirstCopy() {
  const s = useSession();
  const copy = async merge => {
    const result = await s.firstCopy({ merge });
    if (result && result.needsMergeChoice)
      Alert.alert('This phone already holds records', result.message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge them', onPress: () => copy(true) }
      ]);
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <Txt bold size={17}>Paired with {s.status.desktopName}</Txt>
        <Txt tone="dim" style={{ marginTop: 6 }}>
          The next step copies the whole ledger from the computer to this phone. Keep both on the same network until it finishes.
        </Txt>
        {s.busy && <Txt tone="amber" bold style={{ marginTop: 10 }}>{s.busy.text}</Txt>}
        <Button label="Copy the ledger" kind="go" disabled={!!s.busy} onPress={() => copy(false)} style={{ marginTop: 12 }} />
      </Card>
      <Card>
        <Txt tone="dim">Records the computer sends now show no green dot. Only records that arrive in later syncs do.</Txt>
      </Card>
    </ScrollView>
  );
}

/* ---------- connected ---------- */
function Connected() {
  const s = useSession(), t = useTheme(), st = s.status;
  const forget = () => Alert.alert(
    'Forget this computer?',
    'The records on this phone stay. To sync again you pair again, and the phone gets a new range of record numbers.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Forget it', style: 'destructive', onPress: s.unpair }]);
  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Txt bold size={17} style={{ flex: 1 }}>{st.desktopName}</Txt>
          <HelpButton />
        </View>
        <Txt tone={s.ping === 'connected' ? 'ok' : 'dim'} bold>{s.ping === 'connected' ? 'Connected' : 'Not reachable right now'}</Txt>
        <Txt tone="dim" style={{ marginTop: 2 }}>{lastSyncText(st.lastSyncAt)}</Txt>
        <Button label="Sync now" kind="go" disabled={!s.canSync} onPress={s.sync} style={{ marginTop: 12 }} />
      </Card>
      <Card>
        <Txt bold size={16} style={{ marginBottom: 6 }}>Not connecting?</Txt>
        <Txt tone="dim" style={{ marginBottom: 10 }}>The guide shows four ways to put the phone and the computer on the same network.</Txt>
        <Button label="How do I connect?" onPress={() => s.setHelpOpen(true)} />
      </Card>
      <Card>
        <Button label="Forget this computer" kind="warn" disabled={!!s.busy} onPress={forget} />
      </Card>
    </ScrollView>
  );
}

export default function Connect() {
  const s = useSession();
  if (!s.status) return <Skeleton kind="cards" />;
  if (!s.status.paired) return <PairForm />;
  return s.status.needsFullCopy ? <FirstCopy /> : <Connected />;
}
