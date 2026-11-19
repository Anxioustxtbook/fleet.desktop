/* One list screen in the new look (Rentals, Bookings, Vehicles, Drivers, Clients, Payments, Expenses, Fuel, Coop, Sub-hire).
   UI_SPEC 5.2: eyebrow with the record count, title, round add button; search and sort; chip filters with a caption; totals strip;
   rows grouped by month; "No records match."; tap a row for its page. The rows come from the existing table rules (tables.js buildTable). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSession } from '../session.js';
import { useLook, useUI } from '../look.js';
import Icon from '../Icon.js';
import Skeleton from '../Skeleton.js';
import Thumb from '../Thumb.js';
import { Badge, Card, Chip, ChipRow, Eyebrow, MonthHeader, PageHead, RoundBtn, Row, Sheet, StatsStrip, T, TableCard, ViewButton, useToast } from '../kit.js';
import { SORTS, buildTable, tableLists, tableTitle } from '../tables.js';
import { ADD_BUTTONS, markPaidPatch, todayISO } from '../forms.js';
import { EMPTY_TEXT, FOOTER_HINT, isRegister } from '../lifecycle.js';
import { openRecord } from '../RecordPage.js';
import { FULL_LIST, badgeKind, fullTable, sectionsOf, stripsOf } from '../listView.js';

export default function ListScreen({ id }) {
  const S = useSession(), look = useLook(), { t, s: sc, tap } = useUI(), toast = useToast();
  const [data, setData] = useState(null), [arrivals, setArrivals] = useState(new Set());
  const [search, setSearch] = useState(''), [filters, setFilters] = useState({}), [sort, setSort] = useState('newest'), [showExited, setShowExited] = useState(false);
  const [view, setView] = useState(look.recordsView), [sortOpen, setSortOpen] = useState(false), [addOpen, setAddOpen] = useState(false);
  const stamp = S.status ? `${S.status.lastSyncAt || ''}|${JSON.stringify(S.status.counts || {})}|${S.version}` : '';

  const load = useCallback(async () => {
    const next = {}; for (const l of tableLists(id)) next[l] = await S.app.records.all(l);
    setData(next); setArrivals(await S.app.records.newToday());
  }, [S.app, id]);
  useEffect(() => { setSearch(''); setFilters({}); setSort('newest'); setShowExited(false); setData(null); setView(look.recordsView); }, [id]);        // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(e => S.notify(e, 'The list could not be read')); }, [load, stamp]);

  const built = useMemo(() => (data ? buildTable(id, data, { search, filters, sort, arrivals, showExited }) : null), [id, data, search, filters, sort, arrivals, showExited]);
  if (!built) return <Skeleton kind="list" />;

  const reg = isRegister(id), adds = ADD_BUTTONS[id] || [], full = FULL_LIST.includes(id) && view === 'desk';
  const setFilter = (g, v) => setFilters(f => ({ ...f, [g]: f[g] === v ? '' : v }));
  const open = r => openRecord(S, { list: r.list, id: r.id, title: r.title });
  const markPaid = async r => {
    const rental = (data.rentals || []).find(x => String(x.id) === String(r.id)); if (!rental) return;
    await S.app.records.update('rentals', rental.id, markPaidPatch(String(r.key).startsWith('owner') ? 'owner' : 'driver', rental, todayISO()));
    toast('Marked paid'); await S.refresh();
  };
  const onAdd = () => { if (adds.length === 1) S.openForm({ form: adds[0].form, preset: adds[0].preset }); else setAddOpen(true); };

  const amountOf = r => (!r.amount ? null : id === 'expenses' || (id === 'fuel' && r.facets.show === 'Fills') ? { text: `-${r.amount}`, tone: 'red' } : String(r.amount).startsWith('+') ? { text: r.amount, tone: 'green' } : { text: r.amount, tone: 'ink' });
  const renderRow = (r, i, n) => {
    const a = amountOf(r), unpaid = id === 'subhire' && r.st === 'notcleared';
    return (
      <Row key={r.key} last={i === n - 1} onPress={() => open(r)} leading={reg ? <Thumb list={id} id={r.id} /> : null}
        title={<View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(6) }}>{r.isNew ? <View accessibilityLabel="Arrived from the computer today" style={{ width: sc(9), height: sc(9), borderRadius: sc(5), backgroundColor: t.green }} /> : null}<T size={16.5} weight="700" numberOfLines={2} style={{ flexShrink: 1 }}>{r.title}</T></View>}
        sub={r.sub} extra={r.extra || (id === 'vehicles' && r.amount ? `${r.amount} a day` : '')}
        right={<>{a && id !== 'vehicles' ? <T size={14.5} weight="700" mono tone={a.tone}>{a.text}</T> : null}{r.tag ? <Badge text={r.tag} kind={badgeKind(id, r)} /> : null}{unpaid ? <Badge text="Mark paid" kind="gd" icon="check" onPress={() => markPaid(r)} /> : null}</>} />
    );
  };

  const header = (
    <View>
      <PageHead eyebrow={`${built.total} RECORDS`} title={tableTitle(id)} right={<View style={{ flexDirection: 'row', gap: sc(8), alignItems: 'center' }}>{FULL_LIST.includes(id) ? <ViewButton value={view} onChange={v => { setView(v); look.setRecordsView(v); }} /> : null}{adds.length ? <RoundBtn onPress={onAdd} label={adds[0].label} /> : null}</View>} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(10), marginBottom: sc(12) }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: sc(10), height: tap(48), borderRadius: sc(22), backgroundColor: t.card, borderWidth: 1, borderColor: t.line, paddingHorizontal: sc(16) }}>
          <Icon name="search" size={20} color={t.dim} />
          <TextInput value={search} onChangeText={setSearch} placeholder={`Search ${tableTitle(id).toLowerCase()}`} placeholderTextColor={t.dim} autoCorrect={false} autoCapitalize="none" returnKeyType="search" accessibilityLabel={`Search ${tableTitle(id)}`} style={{ flex: 1, color: t.ink, fontSize: sc(16), padding: 0 }} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sort" onPress={() => setSortOpen(true)} style={{ width: tap(48), height: tap(48), borderRadius: tap(48) / 2, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="sl" size={20} /></Pressable>
      </View>
      {reg && (built.exitedCount > 0 || showExited) ? <ChipRow caption="View"><Chip label="Current" on={!showExited} onPress={() => setShowExited(false)} /><Chip label="Exited" count={built.exitedCount} on={showExited} onPress={() => setShowExited(true)} /></ChipRow> : null}
      {built.facetGroups.map(g => (
        <ChipRow key={g.id} caption={g.label}>
          <Chip label="All" on={!filters[g.id]} onPress={() => setFilters(f => ({ ...f, [g.id]: '' }))} />
          {g.options.map(o => <Chip key={o.value} label={o.label} count={o.count} on={filters[g.id] === o.value} onPress={() => setFilter(g.id, o.value)} />)}
        </ChipRow>
      ))}
      {stripsOf(built.totals).map((st, i) => <StatsStrip key={i} items={st} />)}
    </View>
  );
  const sections = sectionsOf(built.items);
  return (
    <>
      <FlatList data={full ? [] : sections} keyExtractor={x => x.key} keyboardShouldPersistTaps="handled" initialNumToRender={3} windowSize={7} contentContainerStyle={{ padding: sc(16), paddingBottom: sc(28) }}
        ListHeaderComponent={header}
        ListEmptyComponent={full ? (
          <TableCard head={fullTable(id, built.rows).head} total={fullTable(id, built.rows).total} onRow={i => built.rows[i] && open(built.rows[i])} rows={fullTable(id, built.rows).rows} />
        ) : <T size={14.5} tone="dim" align="center" style={{ padding: sc(28) }}>{reg && !built.shown && !search && !Object.values(filters).some(Boolean) ? built.empty : 'No records match.'}</T>}
        ListFooterComponent={reg ? <T size={13} tone="dim" align="center" style={{ marginTop: sc(18) }}>{FOOTER_HINT}</T> : null}
        renderItem={({ item }) => (
          <View>
            {item.header ? <MonthHeader name={item.header} count={`${item.rows.length} ${item.rows.length === 1 ? 'record' : 'records'}`} /> : <View style={{ height: sc(4) }} />}
            <Card flush>{item.rows.map((r, i) => renderRow(r, i, item.rows.length))}</Card>
          </View>
        )} />
      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <T size={21} weight="700" style={{ marginBottom: sc(10) }}>Sort</T>
        {[...SORTS.filter(x => x.id !== 'name' || reg).map(x => ({ id: x.id, label: x.id === 'amount' ? 'Highest amount' : x.label })), { id: '_clear', label: 'Clear search' }].map(o => (
          <Pressable key={o.id} accessibilityRole="button" onPress={() => { if (o.id === '_clear') { setSearch(''); setFilters({}); } else setSort(o.id); setSortOpen(false); }}
            style={{ minHeight: tap(0), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: sc(12) }}>
            <T size={16} weight={o.id === sort ? '700' : '400'}>{o.label}</T>{o.id === sort ? <Icon name="check" size={20} color={t.goldt} /> : null}
          </Pressable>
        ))}
      </Sheet>
      <Sheet visible={addOpen} onClose={() => setAddOpen(false)}>
        <T size={21} weight="700" style={{ marginBottom: sc(10) }}>Add</T>
        {adds.map(b => (
          <Pressable key={b.label} accessibilityRole="button" onPress={() => { setAddOpen(false); S.openForm({ form: b.form, preset: b.preset }); }} style={{ minHeight: tap(0), justifyContent: 'center', paddingVertical: sc(12) }}><T size={16} weight="600">{b.label}</T></Pressable>
        ))}
      </Sheet>
    </>
  );
}
