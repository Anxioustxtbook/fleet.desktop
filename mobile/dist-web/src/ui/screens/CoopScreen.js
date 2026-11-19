/* Coop (UI_SPEC 5.2): its own screen. Month chips, line chips, the VAT view switch (display only, 16%), totals with a big TOTAL card,
   rows with In Rentals / To complete, a line detail, Add (from a coop rental, or not yet in Rentals), and a Full list of 16 columns.
   The Excel button saves the client's schedule: the file saving itself arrives with Step 6 (Files and Excel). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSession } from '../session.js';
import { useLook, useUI } from '../look.js';
import Icon from '../Icon.js';
import Skeleton from '../Skeleton.js';
import { Badge, Btn, Card, Chip, ChipRow, PageHead, RoundBtn, Row, Sheet, StatsStrip, T, TableCard, ToggleRow, ViewButton, useToast } from '../kit.js';
import { ADD_BUTTONS, todayISO } from '../forms.js';
import { COOP_HEAD, LINES, buildCoop, coopRow, monthLabel } from '../coopView.js';
import { fmt } from '../tables.js';
import { dsh } from '../dates.js';
import { openRecord } from '../RecordPage.js';

const LISTS = ['coops', 'rentals', 'clients', 'vehicles', 'expenses'];

export default function CoopScreen() {
  const S = useSession(), look = useLook(), toast = useToast(), { t, s: sc, tap } = useUI(), today = useMemo(() => todayISO(), []);
  const [data, setData] = useState(null), [month, setMonth] = useState(today.slice(0, 7)), [line, setLine] = useState('all'), [vat, setVat] = useState(false), [view, setView] = useState(look.recordsView), [addOpen, setAddOpen] = useState(false), [pick, setPick] = useState(null);
  const stamp = S.status ? `${S.status.lastSyncAt || ''}|${S.version}` : '';
  const load = useCallback(async () => { const d = {}; for (const l of LISTS) d[l] = await S.app.records.all(l); setData(d); }, [S.app]);
  useEffect(() => { load().catch(e => S.notify(e, 'Coop could not be read')); }, [load, stamp]);
  const v = useMemo(() => (data ? buildCoop(data, today, { month, line, vat }) : null), [data, today, month, line, vat]);
  if (!v) return <Skeleton kind="list" />;

  const k = n => fmt(n), tt = v.totals, adds = ADD_BUTTONS.coop;
  const monthChips = [[v.thisMonth, 'This month'], [v.last, 'Last month'], ['all', 'All months']];
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: sc(16), paddingBottom: sc(28) }}>
        <PageHead eyebrow={`${v.lines.length} LINES${v.todoCount ? ` · ${v.todoCount} TO COMPLETE` : ''}`} title="Coop" right={<View style={{ flexDirection: 'row', gap: sc(8) }}><ViewButton value={view} onChange={x => { setView(x); look.setRecordsView(x); }} /><RoundBtn onPress={() => setAddOpen(true)} label="Add coop line" /></View>} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(10), marginBottom: sc(8) }}>
          <ChipRow caption="Month">{monthChips.map(([m, l]) => <Chip key={m} label={l} on={month === m} onPress={() => setMonth(m)} />)}</ChipRow>
        </View>
        {month !== 'all' ? <T size={13} tone="dim" style={{ marginBottom: sc(6) }}>{monthLabel(month)}</T> : null}
        <ChipRow caption="Lines">{LINES.map(x => <Chip key={x.id} label={x.label} on={line === x.id} onPress={() => setLine(x.id)} />)}</ChipRow>
        <Card flush style={{ marginVertical: sc(8) }}><ToggleRow last title="VAT view" sub="Display only, 16%. Amounts are kept without VAT." on={vat} onChange={setVat} /></Card>
        {vat ? <T size={13} tone="dim" style={{ marginBottom: sc(8) }}>Charge {k(v.vatInfo.base)} + VAT {k(v.vatInfo.vat)} = {k(v.vatInfo.incl)}. With fuel, driver and allowance ({k(v.vatInfo.extra)}): excl VAT {k(v.vatInfo.totalExcl)} · incl VAT {k(v.vatInfo.totalIncl)}.</T> : null}
        <StatsStrip items={[['DAYS', String(tt.days)], ['KMS', String(tt.km)], ['CHARGE', k(tt.charge)]]} />
        <StatsStrip items={[['FUEL', k(tt.fuel)], ['DRIVER', k(tt.driver)], ['ALLOWANCE', k(tt.allowance)]]} />
        <Card accent={t.gold} style={{ marginVertical: sc(8) }}><T size={11} weight="600" tone="dim" upper>TOTAL</T><T size={26} weight="700" mono style={{ marginTop: sc(4) }}>{k(tt.total)}</T></Card>
        <View style={{ flexDirection: 'row', marginBottom: sc(12) }}><Btn label="Excel schedule" icon="file" onPress={() => toast('Saving the schedule as Excel arrives with Files in Step 6')} /></View>
        {view === 'desk' ? (
          <TableCard head={COOP_HEAD} rows={v.lines.map(x => coopRow(x, k))} onRow={i => setPick(v.lines[i])} />
        ) : v.lines.length ? (
          <Card flush>{v.lines.map((x, i) => (
            <Row key={x.c.id} last={i === v.lines.length - 1} onPress={() => setPick(x)} title={x.c.name || '—'}
              sub={[x.c.department, x.g.vehicle, `${dsh(x.c.start)} to ${dsh(x.c.end || x.c.start)}`, x.c.days ? `${x.c.days} d` : '', x.c.contract ? `Contract ${x.c.contract}` : ''].filter(Boolean).join(' · ')}
              right={<><T size={14.5} weight="700" mono>{k(x.g.total)}</T><Badge text={x.c.rentalId ? 'In Rentals' : 'To complete'} kind={x.c.rentalId ? 'ok' : 'am'} /></>} />))}
          </Card>
        ) : <T size={14.5} tone="dim" align="center" style={{ padding: sc(28) }}>No coop lines yet. Tap + to add the first one.</T>}
      </ScrollView>
      <Sheet visible={!!pick} onClose={() => setPick(null)} footer={pick ? <>
        {pick.c.rentalId ? <Btn go label="Open its rental" onPress={() => { const x = pick; setPick(null); openRecord(S, { list: 'rentals', id: x.c.rentalId, title: `${x.g.reg} · ${x.c.name}` }); }} />
          : <Btn go label="Finish in Rentals" onPress={() => { setPick(null); S.go('rentals'); S.openForm({ form: 'rentals' }); }} />}
        <Btn label="Edit line" onPress={() => { const x = pick; setPick(null); S.openForm({ form: 'coops', record: x.c }); }} /></> : null}>
        {pick ? <><T size={21} weight="700">{pick.c.name || 'Coop line'}</T>
          <T size={14} tone="dim" style={{ marginTop: sc(4), marginBottom: sc(10) }}>{[pick.c.department, pick.g.vehicle, pick.c.contract && `Contract ${pick.c.contract}`].filter(Boolean).join(' · ')}</T>
          {[['Dates', `${dsh(pick.c.start)} to ${dsh(pick.c.end || pick.c.start)}`], ['Hire days', String(pick.c.days || 0)], ['Total KMs', String(pick.g.km)], ['Vehicle charge', k(pick.g.charge)], ['Fuel', k(pick.g.fuel)], ['Driver', k(pick.g.driver)], ['Allowance', k(pick.g.allowance)], ['Total', k(pick.g.total)]].map(([a, b]) => (
            <View key={a} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sc(6) }}><T size={14.5} tone="dim">{a}</T><T size={14.5} weight="700" mono={a !== 'Dates'}>{b}</T></View>))}</> : null}
      </Sheet>
      <Sheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <T size={21} weight="700" style={{ marginBottom: sc(10) }}>Add</T>
        {adds.map(b => <Pressable key={b.label} accessibilityRole="button" onPress={() => { setAddOpen(false); S.openForm({ form: b.form }); }} style={{ minHeight: tap(0), justifyContent: 'center', paddingVertical: sc(12) }}><T size={16} weight="600">{b.label}</T></Pressable>)}
      </Sheet>
    </>
  );
}
