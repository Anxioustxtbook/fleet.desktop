/* Edit one record as plain fields. This is the editor the Review list uses (to fix a held record, or to
   change one the computer replaced). The proper entry forms arrive in Step 2D and will replace it. Every save
   is read back by the records layer; nothing is half-saved. */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../parts.js';
import { useSession, useTheme } from '../session.js';
import { buildPatch, editableFields, recordName } from '../logic.js';

export default function RecordEditor({ editing, onClose, onSaved }) {
  const s = useSession(), t = useTheme(), insets = useSafeAreaInsets();
  const [edits, setEdits] = useState({});
  const [errors, setErrors] = useState({});
  useEffect(() => { setEdits({}); setErrors({}); }, [editing]);
  if (!editing) return null;

  const { list, record } = editing;
  const fields = editableFields(record);
  const shown = f => (f.key in edits ? edits[f.key] : f.value);

  const save = async () => {
    const { patch, errors: bad } = buildPatch(record, edits);
    setErrors(bad);
    if (Object.keys(bad).length) return;
    if (!Object.keys(patch).length) { onClose(); return; }
    try {
      await s.app.records.update(list, record.id, patch);
      await s.refresh();
      onSaved();
    } catch (e) { s.notify(e, 'The change was not saved'); }
  };

  const headerButton = (label, onPress, strong) => (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
      <Text style={{ color: strong ? t.green : t.ink, fontSize: 16, fontWeight: strong ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: t.panel, borderBottomColor: t.line, borderBottomWidth: 1 }}>
          {headerButton('Cancel', onClose)}
          <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' }} numberOfLines={1}>{recordName(list, record.id)}</Text>
          {headerButton('Save', save, true)}
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {fields.map(f => (
            <View key={f.key} style={{ marginBottom: 14 }}>
              <Txt tone="dim" size={12.5} bold style={{ marginBottom: 4 }}>{f.key}</Txt>
              {f.kind === 'locked' && <Txt tone="faint">{f.value} (not edited here)</Txt>}
              {f.kind === 'bool' && <Switch value={!!shown(f)} onValueChange={v => setEdits({ ...edits, [f.key]: v })} trackColor={{ true: t.green }} />}
              {(f.kind === 'text' || f.kind === 'number') && (
                <TextInput value={String(shown(f))} onChangeText={v => setEdits({ ...edits, [f.key]: v })}
                  keyboardType={f.kind === 'number' ? 'decimal-pad' : 'default'} autoCapitalize="none" autoCorrect={false}
                  style={{ borderWidth: 1, borderColor: errors[f.key] ? t.red : t.line, backgroundColor: t.panel, color: t.ink, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 }} />
              )}
              {!!errors[f.key] && <Txt tone="bad" size={13} style={{ marginTop: 3 }}>{errors[f.key]}</Txt>}
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
