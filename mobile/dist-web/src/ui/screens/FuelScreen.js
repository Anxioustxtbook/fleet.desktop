/* Fuel (UI_SPEC 5.2): its own screen. Month arrows and Show chips, four coloured-edge cards, opening / closing, untagged fills,
   a "possible repeat" card, ledger rows, and a Full list with the running balance. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSession } from '../session.js';
import { useLook, useUI } from '../look.js';
import Icon from '../Icon.js';
import Skeleton from '../Skeleton.js';
import { Badge, Card, Chip, ChipRow, PageHead, RoundBtn, Row, Sheet, T, TableCard, ViewButton } from '../kit.js';
import { ADD_BUTTONS, todayISO } from '../forms.js';
import { FUEL_HEAD, SHOWS, buildFuel } from '../fuelView.js';
import { fmt } from '../tables.js';
import { openRecord } from '../RecordPage.js';

const LISTS = ['expenses', 'fuelAccount', 'vehicles', 'rentals', 'clients'];
const ACC_KIND = { Ola: 'gd', Outside: 'bl', Untagged: 'nt', 'Top-up': 'ok' };

export default function FuelScreen() {
  const S = useSession(), look = useLook(), { t, s: sc, tap } = useUI(), today = useMemo(() => todayISO(), []);
  const [data, setData] = useState(null), [month, setMonth] = useState(today.slice(0, 7)), [show, setShow] = useState('all'), [view, setView] = useState(look.recordsView), [addOpen, setAddOpen] = useState(false);
  const stamp = S.status ? `${S.status.lastSyncAt || ''}|${S.version}` : '';
  const load = useCallback(async () => { const d = {}; for (const l of LISTS) d[l] = await S.app.records.all(l); setData(d); }, [S.app]);
  useEffect(() => { load().catch(e => S.notify(e, 'Fuel could not be read')); }, [load, stamp]);
  const f = useMemo(() => (data ? buildFuel(data, today, { month, show }) : null), [data, today, month, show]);
  if (!f) return <Skeleton kind="list" />;

  const adds = ADD_BUTTONS.fuel, c = f.cards, arrow = (dir, to) => (
    <Pressable accessibilityRole="button" accessibilityLabel={dir === 'l' ? 'Earlier month' : 'Later month'} disabled={!to} onPress={() => setMonth(to)} style={{ width: tap(44), height: tap(44), borderRadius: tap(44) / 2, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center', opacity: to ? 1 : 0.4 }}>
      <Icon name={dir} size={20} /></Pressable>);
  const cards = [['OLA BALANCE', c.balance, c.balance < 0 ? t.red : t.gold, c.balance < 0 ? 'red' : 'ink', c.balance < 0 ? 'Owed to the station' : ''], ['PAID IN', c.paidIn, t.green, 'ink', ''], ['TAKEN (OLA)', c.taken, t.orange, 'ink', ''], ['OUTSIDE CASH', c.outside, t.blue, 'ink', '']];
  const open = r => openRecord(S, { list: r.list, id: r.id, title: `${r.car} · ${r.date}` });
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: sc(16), paddingBottom: sc(28) }}>
        <PageHead eyebrow={`${f.count} ENTRIES`} title="Fuel" right={<View style={{ flexDirection: 'row', gap: sc(8) }}><ViewButton value={view} onChange={v => { setView(v); look.setRecordsView(v); }} /><RoundBtn onPress={() => setAddOpen(true)} label="Add fuel" /></View>} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sc(12) }}>
          {arrow('l', f.prev)}
          <Pressable accessibilityRole="button" onPress={() => setMonth(month === 'all' ? today.slice(0, 7) : 'all')}><T size={17} weight="700">{f.label}</T></Pressable>
          {arrow('r', f.next)}
        </View>
        <ChipRow caption="Show">{SHOWS.map(x => <Chip key={x.id} label={x.label} on={show === x.id} onPress={() => setShow(x.id)} />)}</ChipRow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sc(10), marginTop: sc(4), marginBottom: sc(10) }}>
          {cards.map(([label, v, edge, tone, sub]) => (
            <Card key={label} accent={edge} style={{ width: '48%', flexGrow: 1 }}>
              <T size={11} weight="600" tone="dim" upper>{label}</T><T size={20} weight="700" mono tone={tone} style={{ marginTop: sc(6) }}>{fmt(v)}</T>{sub ? <T size={12} tone="red">{sub}</T> : null}
            </Card>))}
        </View>
        <T size={13.5} tone="dim" style={{ marginBottom: sc(6) }}>Opening {fmt(c.opening)} · Closing {fmt(c.closing)}</T>
        {f.untagged.count ? <T size={13.5} tone="dim" style={{ marginBottom: sc(10) }}>{f.untagged.count} untagged {f.untagged.count === 1 ? 'fill' : 'fills'} ({fmt(f.untagged.amount)}) are not counted against Ola.</T> : null}
        {f.repeats ? <Card accent={t.orange} style={{ marginBottom: sc(12) }}><T size={15} weight="700">Possible repeat</T><T size={13.5} tone="dim" style={{ marginTop: sc(3) }}>{f.repeats} {f.repeats === 1 ? 'fill looks' : 'fills look'} entered twice (same car, date and amount). Nothing is removed for you.</T></Card> : null}
        {view === 'desk' ? (
          <TableCard head={FUEL_HEAD} onRow={i => open(f.rows[i])} rows={f.rows.map(r => [r.date, r.kind === 'topup' ? 'Top-up' : 'Fill', r.car, r.note, r.account, (r.kind === 'fill' ? '-' : '+') + fmt(r.amount), r.balance == null ? '' : fmt(r.balance)])} />
        ) : f.rows.length ? (
          <Card flush>{f.rows.map((r, i) => (
            <Row key={r.key} last={i === f.rows.length - 1} onPress={() => open(r)} leading={<View style={{ width: sc(40), height: sc(40), borderRadius: sc(20), backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}><Icon name={r.kind === 'topup' ? 'wallet' : 'fuel'} size={20} color={t.dim} /></View>}
              title={r.car} sub={[r.date, r.note].filter(Boolean).join(' · ')} right={<><T size={14.5} weight="700" mono tone={r.kind === 'fill' ? 'red' : 'green'}>{(r.kind === 'fill' ? '-' : '+') + fmt(r.amount)}</T><Badge text={r.account} kind={ACC_KIND[r.account] || 'nt'} /></>} />))}
          </Card>
        ) : <T size={14.5} tone="dim" align="center" style={{ padding: sc(28) }}>{f.count ? 'No records match.' : 'No fuel entries yet. Tap + to add the first one.'}</T>}
      </ScrollView>
      <Sheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <T size={21} weight="700" style={{ marginBottom: sc(10) }}>Add</T>
        {adds.map(b => <Pressable key={b.label} accessibilityRole="button" onPress={() => { setAddOpen(false); S.openForm({ form: b.form, preset: b.preset }); }} style={{ minHeight: tap(0), justifyContent: 'center', paddingVertical: sc(12) }}><T size={16} weight="600">{b.label}</T></Pressable>)}
      </Sheet>
    </>
  );
}
