import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { Button, Card, Txt } from './parts.js';
import { useSession, useTheme } from './session.js';
import { DEFAULT_CSV_EXPORT, normalizeCsvExport } from '../csvExport.js';

const MODES = [
  { value: 'none', label: 'No tax' },
  { value: 'inclusive', label: 'Inclusive' },
  { value: 'exclusive', label: 'Exclusive' }
];

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', maxLength }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 10 }}>
      <Txt tone="dim" size={13}>{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.inkFaint}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="none"
        style={{ color: t.ink, backgroundColor: t.bg, borderColor: t.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4, minHeight: 42 }}
      />
    </View>
  );
}

function RuleEditor({ label, rule, onChange, allowInheritedRate = false }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 12, paddingTop: 10, borderTopColor: t.line, borderTopWidth: 1 }}>
      <Txt bold size={14}>{label}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {MODES.map(option => {
          const selected = rule.mode === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange({ ...rule, mode: option.value })}
              style={{ borderColor: selected ? t.green : t.line, backgroundColor: selected ? t.panel2 : t.panel, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginRight: 7, marginBottom: 5 }}>
              <Txt size={13} tone={selected ? 'ok' : 'dim'} bold={selected}>{option.label}</Txt>
            </Pressable>
          );
        })}
      </View>
      {rule.mode !== 'none' && (
        <Field
          label={`Tax rate (%)${allowInheritedRate ? ' — blank uses default' : ''}`}
          value={rule.rate == null ? '' : String(rule.rate)}
          onChangeText={value => onChange({ ...rule, rate: value === '' && allowInheritedRate ? null : Number(value) || 0 })}
          placeholder={allowInheritedRate ? 'Use default rate' : 'e.g. 16'}
          keyboardType="decimal-pad"
        />
      )}
    </View>
  );
}

export default function CsvExport() {
  const s = useSession(), t = useTheme();
  const [settings, setSettings] = useState(DEFAULT_CSV_EXPORT);
  const [draft, setDraft] = useState(DEFAULT_CSV_EXPORT);
  const [categories, setCategories] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [saved, expenses] = await Promise.all([
        s.app.csvExport.getSettings(),
        s.app.records.all('expenses')
      ]);
      const normalized = normalizeCsvExport(saved);
      setSettings(normalized);
      setDraft(normalized);
      setCategories([...new Set([
        ...expenses.map(x => String(x && x.category || 'Other')),
        ...Object.keys(normalized.categoryRules)
      ])].sort((a, b) => a.localeCompare(b)));
    } catch (e) {
      s.notify(e, 'CSV settings could not be opened');
    } finally { setLoading(false); }
  }, [s.app, s.notify]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await s.app.csvExport.saveSettings(draft);
      setSettings(saved);
      setDraft(saved);
      s.say('CSV settings saved on this phone');
    } catch (e) { s.notify(e, 'CSV settings could not be saved'); }
    finally { setSaving(false); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await s.app.csvExport.export({ start, end });
      s.say('CSV is ready to share');
    } catch (e) { s.notify(e, 'CSV export failed'); }
    finally { setExporting(false); }
  };

  const updateCategoryRule = (category, rule) => setDraft(current => ({
    ...current,
    categoryRules: { ...current.categoryRules, [category]: rule }
  }));

  if (loading) {
    return <Card><Txt tone="dim">Loading CSV settings...</Txt></Card>;
  }

  return (
    <Card>
      <Txt bold size={16.5}>CSV export</Txt>
      <Txt tone="dim" size={13.5} style={{ marginTop: 3 }}>
        Optional tax-ready CSV for rentals and expenses. Tax calculations affect this export only; the ledger is unchanged.
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt bold>Enable CSV export</Txt>
          <Txt tone="faint" size={12.5}>Off by default</Txt>
        </View>
        <Switch
          accessibilityLabel="Enable CSV export"
          value={draft.enabled}
          onValueChange={enabled => setDraft(current => ({ ...current, enabled }))}
          trackColor={{ false: t.line, true: t.green }}
        />
      </View>
      <Txt tone="faint" size={12.5} style={{ marginTop: 2 }}>
        These settings are saved on this phone. Phone settings are not included in desktop sync.
      </Txt>

      <Field
        label="Currency code"
        value={draft.currency}
        onChangeText={currency => setDraft(current => ({ ...current, currency }))}
        placeholder="KES"
        maxLength={12}
      />
      <RuleEditor
        label="Default tax treatment"
        rule={draft.defaultRule}
        onChange={defaultRule => setDraft(current => ({ ...current, defaultRule }))}
      />
      {categories.map(category => (
        <RuleEditor
          key={category}
          label={`${category} override`}
          rule={draft.categoryRules[category] || { mode: 'none', rate: null }}
          allowInheritedRate
          onChange={rule => updateCategoryRule(category, rule)}
        />
      ))}
      {!categories.length && <Txt tone="faint" size={13} style={{ marginTop: 10 }}>Expense-category overrides will appear when expense records are available.</Txt>}

      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <Field label="From (YYYY-MM-DD, optional)" value={start} onChangeText={setStart} placeholder="2026-01-01" />
        </View>
        <View style={{ flex: 1, marginLeft: 6 }}>
          <Field label="To (YYYY-MM-DD, optional)" value={end} onChangeText={setEnd} placeholder="2026-12-31" />
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <Button label={saving ? 'Saving...' : 'Save CSV settings'} disabled={saving || !dirty} onPress={save} />
      </View>
      <View style={{ marginTop: 8 }}>
        <Button
          label={exporting ? 'Preparing CSV...' : 'Export CSV'}
          kind="go"
          disabled={!settings.enabled || dirty || exporting}
          onPress={exportCsv}
        />
      </View>
      {dirty && <Txt tone="amber" size={12.5} style={{ marginTop: 8 }}>Save your changes before exporting.</Txt>}
    </Card>
  );
}
