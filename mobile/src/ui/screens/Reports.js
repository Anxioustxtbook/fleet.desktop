/* Reports: Day, Week, Month, Year or your own dates; the cards; revenue by car; cars out now; a single-car view with its statement.
   Looking only. Printing and saving archive files stay on the computer. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card, Txt } from '../parts.js';
import { useSession, useTheme } from '../session.js';
import Skeleton from '../Skeleton.js';
import { PERIODS, buildReport, carStatement, periodRange, stepPeriod } from '../reportsView.js';
import { fmt } from '../tables.js';
import { parseDate, todayISO } from '../forms.js';

export default function Reports() {
  const s = useSession(), t = useTheme(), today = todayISO();
  const [data, setData] = useState(null), [kind, setKind] = useState('month'), [anchor, setAnchor] = useState(today), [car, setCar] = useState(''), [custom, setCustom] = useState({ from: '', to: '' }), [raw, setRaw] = useState({ from: '', to: '' });
  const stamp = s.status ? `${s.status.lastSyncAt || ''}|${JSON.stringify(s.status.counts || {})}` : '';
  const load = useCallback(async () => { const d = {}; for (const l of ['rentals', 'vehicles', 'clients', 'payments', 'expenses', 'drivers']) d[l] = await s.app.records.all(l); setData(d); }, [s.app]);
  useEffect(() => { load().catch(e => s.notify(e, 'Reports could not be read')); }, [load, stamp]);
  const range = useMemo(() => periodRange(kind, anchor, custom), [kind, anchor, custom]);
  const r = useMemo(() => (data ? buildReport(data, range, { vehicleId: car, today }) : null), [data, range, car, today]);
  const st = useMemo(() => (data && car ? carStatement(data, car, range) : []), [data, car, range]);
  if (!r) return <Skeleton kind="report" />;
  const chip = (label, on, press, k) => <Pressable key={k || label} onPress={press} style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, marginRight: 6, backgroundColor: on ? t.green : t.panel, borderColor: on ? t.green : t.line }}><Text style={{ color: on ? '#FFFFFF' : t.inkDim, fontSize: 13, fontWeight: '600' }}>{label}</Text></Pressable>;
  const row = (a, b, bold, k) => <View key={k || a} style={{ flexDirection: 'row', paddingVertical: 3 }}><Text style={{ flex: 1, color: t.inkDim, fontSize: 13.5 }}>{a}</Text><Text style={{ color: t.ink, fontSize: 13.5, fontWeight: bold ? '700' : '400' }}>{b}</Text></View>;
  const box = k => <TextInput value={raw[k]} onChangeText={x => setRaw(p => ({ ...p, [k]: x }))} onEndEditing={() => { const d = parseDate(raw[k]); setRaw(p => ({ ...p, [k]: d })); setCustom(p => ({ ...p, [k]: d })); }} placeholder={k === 'from' ? 'From' : 'To'} placeholderTextColor={t.inkFaint} keyboardType="numbers-and-punctuation" style={{ flex: 1, marginRight: 6, backgroundColor: t.panel, borderColor: t.line, borderWidth: 1, borderRadius: 9, color: t.ink, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14 }} />;
  return (
    <ScrollView contentContainerStyle={{ padding: 10, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>{PERIODS.map(([k, l]) => chip(l, kind === k, () => setKind(k)))}</ScrollView>
      {kind === 'custom'
        ? <View style={{ flexDirection: 'row', marginTop: 8 }}>{box('from')}{box('to')}</View>
        : <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}><Pressable onPress={() => setAnchor(stepPeriod(kind, anchor, -1))} hitSlop={8} style={{ padding: 10 }}><Text style={{ color: t.ink, fontSize: 20 }}>‹</Text></Pressable><Text style={{ flex: 1, textAlign: 'center', color: t.ink, fontSize: 16, fontWeight: '700' }}>{range.label}</Text><Pressable onPress={() => setAnchor(stepPeriod(kind, anchor, 1))} hitSlop={8} style={{ padding: 10 }}><Text style={{ color: t.ink, fontSize: 20 }}>›</Text></Pressable></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>{chip('All cars', !car, () => setCar(''))}{(data.vehicles || []).map(v => chip(v.reg || '—', String(car) === String(v.id), () => setCar(String(v.id)), 'v' + v.id))}</ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 }}>
        {r.cards.map(([a, b]) => <View key={a} style={{ width: '50%', padding: 4 }}><View style={{ backgroundColor: t.panel, borderColor: t.line, borderWidth: 1, borderRadius: 12, padding: 11 }}><Text style={{ color: t.inkFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{a}</Text><Text style={{ color: t.ink, fontSize: 16, fontWeight: '700', marginTop: 2 }}>{b}</Text></View></View>)}
      </View>
      {!car && <Card><Txt bold>Revenue by car</Txt>{r.byCar.length ? r.byCar.map(c => row(`${c.reg} · ${c.rentals} rental(s)`, `${fmt(c.billed)}  (net ${fmt(c.net)})`, false, 'c' + c.vehicleId)) : <Txt tone="dim" size={13.5}>Nothing in this period.</Txt>}</Card>}
      <Card><Txt bold>Cars out now</Txt>{r.carsOut.length ? r.carsOut.map(o => row(`${o.reg} · ${o.client}`, o.overdue ? `Due ${o.due} (late)` : o.due ? `Due ${o.due}` : '', o.overdue, 'o' + o.id)) : <Txt tone="dim" size={13.5}>No car is out on an Active rental.</Txt>}</Card>
      {!!car && <Card><Txt bold>Statement for this car</Txt>{st.length ? st.map((x, i) => row(`${x.date} · ${x.text}`, `${x.charge ? '+' + fmt(x.charge) : '-' + fmt(x.cost)}  = ${fmt(x.running)}`, false, 's' + i)) : <Txt tone="dim" size={13.5}>Nothing in this period.</Txt>}</Card>}
      <Txt tone="faint" size={12}>Printing and saving month or year files are done on the computer.</Txt>
    </ScrollView>
  );
}
