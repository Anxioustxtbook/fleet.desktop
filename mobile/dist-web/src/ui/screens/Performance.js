/* Performance: every rental with its net, filters, totals, and a By car tab. A fixed set of figures per rental (no column picker). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Txt } from '../parts.js';
import { useSession, useTheme } from '../session.js';
import Skeleton from '../Skeleton.js';
import { PERF_FACETS, buildPerformance } from '../performanceView.js';
import { fmt } from '../tables.js';
import { parseDate } from '../forms.js';

export default function Performance() {
  const s = useSession(), t = useTheme();
  const [data, setData] = useState(null), [f, setF] = useState({ from: '', to: '', vehicleId: '', type: '', search: '' }), [tab, setTab] = useState('rentals'), [raw, setRaw] = useState({ from: '', to: '' });
  const stamp = s.status ? `${s.status.lastSyncAt || ''}|${JSON.stringify(s.status.counts || {})}` : '';
  const load = useCallback(async () => { const d = {}; for (const l of ['rentals', 'vehicles', 'clients', 'drivers', 'payments', 'expenses']) d[l] = await s.app.records.all(l); setData(d); }, [s.app]);
  useEffect(() => { load().catch(e => s.notify(e, 'Performance could not be read')); }, [load, stamp]);
  const v = useMemo(() => (data ? buildPerformance(data, f) : null), [data, f]);
  if (!v) return <Skeleton kind="list" />;
  const chip = (label, on, press, k) => <Pressable key={k || label} onPress={press} style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, marginRight: 6, backgroundColor: on ? t.green : t.panel, borderColor: on ? t.green : t.line }}><Text style={{ color: on ? '#FFFFFF' : t.inkDim, fontSize: 13, fontWeight: '600' }}>{label}</Text></Pressable>;
  const dateBox = (k, label) => <TextInput value={raw[k]} onChangeText={x => setRaw(r => ({ ...r, [k]: x }))} onEndEditing={() => { const d = parseDate(raw[k]); setRaw(r => ({ ...r, [k]: d })); setF(p => ({ ...p, [k]: d })); }} placeholder={label} placeholderTextColor={t.inkFaint} keyboardType="numbers-and-punctuation" style={{ flex: 1, marginRight: 6, backgroundColor: t.panel, borderColor: t.line, borderWidth: 1, borderRadius: 9, color: t.ink, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14 }} />;
  const money = (x, tone) => <Text style={{ color: tone && x < 0 ? t.red : t.ink, fontSize: 14, fontWeight: '700' }}>{fmt(x)}</Text>;
  const line = (a, b) => <View style={{ flexDirection: 'row', marginTop: 2 }}><Text style={{ color: t.inkDim, fontSize: 12.5, flex: 1 }}>{a}</Text><Text style={{ color: t.ink, fontSize: 12.5 }}>{b}</Text></View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 10, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row' }}>{dateBox('from', 'From (pickup)')}{dateBox('to', 'To (pickup)')}</View>
        <TextInput value={f.search} onChangeText={x => setF(p => ({ ...p, search: x }))} placeholder="Search car, client, driver, contract" placeholderTextColor={t.inkFaint} autoCorrect={false} autoCapitalize="none" style={{ marginTop: 6, backgroundColor: t.panel, borderColor: t.line, borderWidth: 1, borderRadius: 9, color: t.ink, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>{chip('All cars', !f.vehicleId, () => setF(p => ({ ...p, vehicleId: '' })))}{(data.vehicles || []).map(c => chip(c.reg || '—', String(f.vehicleId) === String(c.id), () => setF(p => ({ ...p, vehicleId: String(c.id) })), 'v' + c.id))}</ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>{PERF_FACETS.map(([k, l]) => chip(`${l} ${v.counts[k]}`, f.type === k, () => setF(p => ({ ...p, type: p.type === k ? '' : k })), k))}</ScrollView>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>{chip('Rentals', tab === 'rentals', () => setTab('rentals'))}{chip('By car', tab === 'car', () => setTab('car'))}</View>
      </View>
      {tab === 'rentals'
        ? <FlatList data={v.rows} keyExtractor={r => String(r.id)} contentContainerStyle={{ paddingBottom: 10 }} ListEmptyComponent={<Txt tone="dim" style={{ padding: 24, textAlign: 'center' }}>No rentals match.</Txt>}
            renderItem={({ item: r }) => (
              <View style={{ marginHorizontal: 10, marginTop: 8, padding: 11, backgroundColor: t.panel, borderRadius: 12, borderWidth: 1, borderColor: t.line }}>
                <View style={{ flexDirection: 'row' }}><Text style={{ flex: 1, color: t.ink, fontSize: 15, fontWeight: '700' }}>{r.reg} · {r.client}</Text>{money(r.net, true)}</View>
                <Text style={{ color: t.inkDim, fontSize: 12.5, marginTop: 2 }}>{r.type} · {r.pickup} to {r.ret}{r.days ? ` · ${r.days} day(s)` : ''}</Text>
                {line('Amount', fmt(r.amount))}{!!r.fuel && line('Fuel', fmt(r.fuel))}{!!r.allowance && line('Allowance', fmt(r.allowance))}{!!r.sub && line('Sub-hire cost', fmt(r.sub))}{!!r.driverPay && line('Sub-hire driver pay', fmt(r.driverPay))}{!!r.owed && line('Still owed', fmt(r.owed))}
              </View>)} />
        : <FlatList data={v.byCar} keyExtractor={c => String(c.vehicleId)} ListEmptyComponent={<Txt tone="dim" style={{ padding: 24, textAlign: 'center' }}>No rentals match.</Txt>}
            renderItem={({ item: c }) => <View style={{ marginHorizontal: 10, marginTop: 8, padding: 11, backgroundColor: t.panel, borderRadius: 12, borderWidth: 1, borderColor: t.line }}><View style={{ flexDirection: 'row' }}><Text style={{ flex: 1, color: t.ink, fontSize: 15, fontWeight: '700' }}>{c.reg}</Text>{money(c.net, true)}</View>{line(`${c.rentals} rental(s), ${c.days} day(s)`, fmt(c.amount))}{!!c.fuel && line('Fuel', fmt(c.fuel))}</View>} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.panel2, borderTopColor: t.line, borderTopWidth: 1 }}>
        {[['Rentals', String(v.totals.rentals)], ['Amount', fmt(v.totals.amount)], ['Fuel', fmt(v.totals.fuel)], ['Net', fmt(v.totals.net)]].map(([a, b]) => <View key={a} style={{ marginRight: 16 }}><Text style={{ color: t.inkFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{a}</Text><Text style={{ color: t.ink, fontSize: 14, fontWeight: '700' }}>{b}</Text></View>)}
      </View>
    </View>
  );
}
