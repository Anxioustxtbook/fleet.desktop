/* One record in words: links shown as names (the car's number plate, the client's name), money in the desktop's format.
   Edit opens the record's entry form (records without a form, like Coop lines, use the plain editor). */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Txt } from '../parts.js';
import { useSession, useTheme } from '../session.js';
import { describeRecord } from '../tables.js';
import { recordName } from '../logic.js';
import { editBlocked, formIdFor } from '../forms.js';
import RecordEditor from './RecordEditor.js';
import EntryForm from './EntryForm.js';

export default function RecordView({ item, data, onClose, onChanged }) {
  const s = useSession(), t = useTheme(), insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(null), [form, setForm] = useState(null);
  if (!item) return null;
  const list = item.list, record = (data && data[list] || []).find(r => String(r.id) === String(item.id));
  const fields = record ? describeRecord(record, data) : [];
  const edit = async () => { const r = await s.app.records.get(list, item.id); if (!r) return; const id = formIdFor(list, r); if (id && !editBlocked(list, r)) setForm({ form: id, record: r }); else if (!editBlocked(list, r)) setEditing({ list, record: r }); };
  const blocked = record ? editBlocked(list, record) : '';
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: t.panel, borderBottomColor: t.line, borderBottomWidth: 1 }}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: t.ink, fontSize: 16 }}>Close</Text></Pressable>
          <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' }} numberOfLines={1}>{recordName(list, item.id)}</Text>
          <View style={{ width: 70 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }}>
          <Txt bold size={18} style={{ marginBottom: 2 }}>{item.title}</Txt>
          {!!item.sub && <Txt tone="dim" style={{ marginBottom: 12 }}>{item.sub}</Txt>}
          {!record && <Txt tone="dim">This record is not on the phone any more.</Txt>}
          {fields.map(f => (
            <View key={f.key} style={{ paddingVertical: 8, borderBottomColor: t.line, borderBottomWidth: 1 }}>
              <Txt tone="faint" size={12} bold>{f.label}</Txt>
              <Txt>{f.value}</Txt>
            </View>
          ))}
          {!!blocked && <Txt tone="amber" style={{ marginTop: 14 }}>{blocked}</Txt>}
          {!!record && !blocked && <View style={{ marginTop: 18 }}><Button label="Edit" kind="go" onPress={edit} /></View>}
        </ScrollView>
        {!!form && <EntryForm request={form} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await onChanged(); }} />}
        <RecordEditor editing={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onChanged(); }} />
      </View>
    </Modal>
  );
}
