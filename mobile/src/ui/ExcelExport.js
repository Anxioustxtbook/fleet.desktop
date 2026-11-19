import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Card, Hint, T } from './kit.js';
import { useSession } from './session.js';
import { useUI } from './look.js';

const SCOPES = [
  { id: 'current', label: 'This month' },
  { id: 'previous', label: 'Last month' },
  { id: 'year', label: 'Whole year' }
];

export default function ExcelExport() {
  const s = useSession(), { t, s: scale } = useUI();
  const [scope, setScope] = useState('current'), [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const result = await s.app.excelFiles.export(scope);
      s.say(`Excel ready · ${result.total} records`);
    } catch (error) {
      s.notify(error, 'Excel could not be saved');
    } finally { setBusy(false); }
  };
  return (
    <Card>
      <T size={16.5} weight="700">Save as Excel</T>
      <T size={13.5} tone="dim" style={{ marginTop: scale(4) }}>Choose a period. The workbook uses FleetPilot’s desktop sheet names and columns.</T>
      <View style={{ flexDirection: 'row', gap: scale(7), marginTop: scale(12) }}>
        {SCOPES.map(option => {
          const selected = scope === option.id;
          return (
            <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setScope(option.id)}
              style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(5), borderRadius: scale(14), borderWidth: 1, borderColor: selected ? t.green : t.line, backgroundColor: selected ? t.greenbg : t.card2 }}>
              <T size={12.5} weight={selected ? '700' : '500'} tone={selected ? 'green' : 'dim'} align="center">{option.label}</T>
            </Pressable>
          );
        })}
      </View>
      <Hint style={{ marginTop: scale(8) }}>On Android, choose a save or share destination from the phone’s file/share sheet. The workbook is not kept in the app’s records.</Hint>
      <Btn go label={busy ? 'Preparing Excel…' : 'Choose destination'} disabled={busy} onPress={save} style={{ flex: 0, marginTop: scale(12) }} />
    </Card>
  );
}
