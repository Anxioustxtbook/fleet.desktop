/* The rent alert. The computer fills a month's Rent from its standing rent setting; the phone does not have that setting,
   so instead of guessing a figure it tells you which months have no Rent entry and lets you add it by hand (one tap opens
   the Expense form already set to Rent, that month, and the last rent you entered). Shows nothing when no month is missing. */

import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Txt } from './parts.js';
import { useTheme } from './session.js';
import { rentMissing, rentPreset } from './audit.js';
import { monthName, fmt } from './tables.js';
import EntryForm from './screens/EntryForm.js';

export default function RentAlert({ data, onSaved }) {
  const t = useTheme(), [form, setForm] = useState(null);
  const rent = useMemo(() => (data ? rentMissing(data) : null), [data]);
  if (!rent || !rent.recent.length) return null;
  const list = rent.recent.map(monthName).join(', ');
  return (
    <View style={{ backgroundColor: t.panel, borderColor: t.amber, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <Txt bold>Rent not entered: {list}</Txt>
      <Txt tone="dim" size={13.5} style={{ marginTop: 3 }}>The phone does not know the standing rent, so those months show no Rent. Add the rent so the figures match the computer.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {rent.recent.map(m => (
          <Pressable key={m} accessibilityRole="button" onPress={() => setForm({ form: 'expenses', preset: rentPreset(m, rent.last) })} style={{ borderWidth: 1, borderColor: t.amber, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14, marginRight: 8, marginBottom: 6 }}>
            <Text style={{ color: t.amber, fontSize: 13.5, fontWeight: '700' }}>Add rent for {monthName(m).split(' ')[0]}</Text>
          </Pressable>
        ))}
      </View>
      {!!rent.earlier && <Txt tone="faint" size={12.5}>{rent.earlier} earlier {rent.earlier === 1 ? 'month has' : 'months have'} none either. Add them from Expenses.</Txt>}
      {!!form && <EntryForm request={form} onClose={() => setForm(null)} onSaved={async (r, more) => { if (!more) setForm(null); await onSaved(); }} />}
    </View>
  );
}
