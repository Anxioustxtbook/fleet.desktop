import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSession } from '../session.js';
import { useUI } from '../look.js';
import { Badge, Btn, Card, Chip, ChipRow, PageHead, Row, Section, T } from '../kit.js';
import Icon from '../Icon.js';
import Skeleton from '../Skeleton.js';
import { DAYS, monthGrid, shiftMonth } from '../calendarView.js';
import { todayISO } from '../forms.js';
import { vehicleColor } from '../../shared/calendarCore.js';
import { openRecord } from '../RecordPage.js';
import EntryForm from './EntryForm.js';

function dateTitle(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Calendar() {
  const S = useSession(), { t, s: sc, tap } = useUI(), today = todayISO();
  const [ym, setYm] = useState(() => ({ year: +today.slice(0, 4), month: +today.slice(5, 7) - 1 }));
  const [car, setCar] = useState('');
  const [sel, setSel] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const stamp = S.status ? `${S.status.lastSyncAt || ''}|${JSON.stringify(S.status.counts || {})}|${S.version}` : String(S.version);
  const load = useCallback(async () => {
    setError(null);
    const lists = ['vehicles', 'clients', 'bookings', 'rentals'];
    const records = await Promise.all(lists.map(list => S.app.records.all(list)));
    setData(Object.fromEntries(lists.map((list, index) => [list, records[index]])));
  }, [S.app]);
  useEffect(() => { load().catch(reason => { setError(reason); S.notify(reason, 'The calendar could not be read'); }); }, [load, stamp]);

  const allGrid = useMemo(() => (data ? monthGrid(data, ym.year, ym.month, { today }) : null), [data, ym, today]);
  const grid = useMemo(() => (data ? monthGrid(data, ym.year, ym.month, { vehicleId: car, today }) : null), [data, ym, car, today]);
  if (!grid || !allGrid) return error
    ? <ScrollView contentContainerStyle={{ padding: sc(16) }}><Card><T size={15} tone="red">The calendar could not be read: {error.message}</T><Btn go label="Try again" onPress={() => load().catch(reason => { setError(reason); S.notify(reason, 'The calendar could not be read'); })} style={{ marginTop: sc(12) }} /></Card></ScrollView>
    : <Skeleton kind="calendar" />;

  const selectedDay = sel || (today.slice(0, 7) === `${ym.year}-${String(ym.month + 1).padStart(2, '0')}` ? today : '');
  const picked = selectedDay ? grid.weeks.flat().find(cell => cell && cell.day === selectedDay) : null;
  const allPicked = selectedDay ? allGrid.weeks.flat().find(cell => cell && cell.day === selectedDay) : null;
  const vehicles = data.vehicles || [];
  const busyByVehicle = new Map((allPicked ? allPicked.items : []).map(item => [String(item.vehicleId), item]));
  const freeCount = vehicles.filter(vehicle => vehicle.status !== 'Inactive' && !busyByVehicle.has(String(vehicle.id))).length;
  const fleetCount = vehicles.filter(vehicle => vehicle.status !== 'Inactive').length;
  const nav = by => { setYm(current => shiftMonth(current.year, current.month, by)); setSel(''); };
  const book = vehicleId => {
    if (!selectedDay) return;
    setForm({ form: 'bookings', preset: { values: { pickup: selectedDay, return: selectedDay, ...(vehicleId == null ? {} : { vehicleId }) } } });
  };
  const openItem = item => {
    if (!item) return;
    const list = item.kind === 'booking' ? 'bookings' : 'rentals';
    openRecord(S, { list, id: item.id, title: `${item.reg} · ${item.client}` });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: sc(16), paddingBottom: sc(28) }} showsVerticalScrollIndicator={false}>
      <PageHead eyebrow="Calendar" title={grid.title} right={
        <View style={{ flexDirection: 'row', gap: sc(8) }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => nav(-1)} style={{ width: tap(40), height: tap(40), borderRadius: sc(14), alignItems: 'center', justifyContent: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
            <Icon name="l" size={18} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => nav(1)} style={{ width: tap(40), height: tap(40), borderRadius: sc(14), alignItems: 'center', justifyContent: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
            <Icon name="r" size={18} />
          </Pressable>
        </View>
      } />

      <ChipRow>
        <Chip label="All cars" on={!car} onPress={() => setCar('')} />
        {vehicles.map(vehicle => (
          <Pressable key={String(vehicle.id)} accessibilityRole="button" accessibilityState={{ selected: String(car) === String(vehicle.id) }} onPress={() => setCar(String(vehicle.id))}
            style={{ minHeight: tap(0), flexDirection: 'row', alignItems: 'center', gap: sc(7), paddingVertical: sc(9), paddingHorizontal: sc(14), borderRadius: sc(20), borderWidth: 1,
              backgroundColor: String(car) === String(vehicle.id) ? t.gold : t.card, borderColor: String(car) === String(vehicle.id) ? t.gold : t.line }}>
            <View style={{ width: sc(8), height: sc(8), borderRadius: sc(4), backgroundColor: vehicleColor(data, vehicle.id) }} />
            <T size={14} weight="600" tone={String(car) === String(vehicle.id) ? 'onfab' : 'ink'}>{vehicle.reg || '—'}</T>
          </Pressable>
        ))}
      </ChipRow>

      {!!grid.summary && <T size={13} tone="dim" style={{ marginBottom: sc(8) }}>{grid.summary.booked} days booked · {grid.summary.free} days free this month</T>}

      <Card flush>
        <View style={{ flexDirection: 'row', backgroundColor: t.card2 }}>
          {DAYS.map(day => <View key={day} style={{ width: '14.2857%', paddingVertical: sc(9), alignItems: 'center' }}><T size={11} weight="700" tone="dim">{day[0]}</T></View>)}
        </View>
        {grid.weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={{ flexDirection: 'row' }}>
            {week.map((cell, dayIndex) => cell ? (
              <Pressable key={cell.day} accessibilityRole="button" accessibilityLabel={`${dateTitle(cell.day)}${cell.holiday ? `, ${cell.holiday}` : ''}${cell.booked ? ', booked' : ', free'}`}
                accessibilityState={{ selected: selectedDay === cell.day }} onPress={() => setSel(cell.day)}
                style={{ width: '14.2857%', minHeight: sc(62), padding: sc(4), borderTopWidth: 1, borderLeftWidth: dayIndex ? 1 : 0, borderColor: t.line,
                  backgroundColor: selectedDay === cell.day ? t.goldbg : cell.holiday ? t.card2 : t.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T size={12} weight={cell.today ? '800' : '600'} tone={cell.today ? 'gold' : 'ink'}>{cell.d}</T>
                  {cell.holiday ? <View style={{ width: sc(5), height: sc(5), borderRadius: sc(3), backgroundColor: t.red }} /> : null}
                </View>
                {car ? <T size={9.5} weight="700" tone={cell.booked ? 'red' : 'green'} numberOfLines={1}>{cell.booked ? 'Booked' : 'Free'}</T>
                  : cell.lines.slice(0, 3).map((line, index) => <View key={`${line.reg}-${index}`} style={{ height: sc(3), borderRadius: sc(2), marginTop: sc(3), backgroundColor: line.color, opacity: line.kind === 'booking' ? 0.55 : 1 }} />)}
                {!car && cell.more > 0 ? <T size={9} tone="dim">+{cell.more}</T> : null}
              </Pressable>
            ) : <View key={`empty-${weekIndex}-${dayIndex}`} style={{ width: '14.2857%', minHeight: sc(62), borderTopWidth: 1, borderLeftWidth: dayIndex ? 1 : 0, borderColor: t.line, backgroundColor: t.card2 }} />)}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: sc(18), paddingHorizontal: sc(16), paddingVertical: sc(12), borderTopWidth: 1, borderColor: t.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(6) }}><View style={{ width: sc(18), height: sc(3), borderRadius: sc(2), backgroundColor: t.blue }} /><T size={12} tone="dim">Out</T></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(6) }}><View style={{ width: sc(18), height: sc(3), borderRadius: sc(2), backgroundColor: t.blue, opacity: 0.5 }} /><T size={12} tone="dim">Booked</T></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(6) }}><View style={{ width: sc(6), height: sc(6), borderRadius: sc(3), backgroundColor: t.red }} /><T size={12} tone="dim">Holiday</T></View>
        </View>
      </Card>

      {picked ? (
        <>
          <Section title={dateTitle(picked.day)} />
          <T size={13} tone="dim" style={{ marginTop: -sc(8), marginBottom: sc(10) }}>
            {picked.holiday ? `${picked.holiday}${picked.tbc ? ' · date to be confirmed · ' : ' · '}` : ''}
            {car ? (picked.booked ? 'Booked' : 'Free') : `${freeCount} of ${fleetCount} cars free`}
          </T>
          <Card flush>
            {vehicles.filter(vehicle => vehicle.status !== 'Inactive' && (!car || String(vehicle.id) === String(car))).map((vehicle, index, list) => {
              const item = busyByVehicle.get(String(vehicle.id));
              const kind = item ? (item.kind === 'booking' ? 'gd' : 'am') : 'ok';
              const status = item ? (item.kind === 'booking' ? 'Booked' : 'Out') : 'Free';
              return (
                <Row key={String(vehicle.id)} last={index === list.length - 1} dot={vehicleColor(data, vehicle.id)}
                  title={vehicle.reg || '—'} sub={[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}
                  extra={item ? `${item.client} · ${item.kind === 'booking' ? 'Booking' : 'Rental'} ${item.from.slice(5)} to ${item.to.slice(5)}` : undefined}
                  right={<Badge text={status} kind={kind} />}
                  onPress={() => item ? openItem(item) : book(vehicle.id)} />
              );
            })}
          </Card>
          {!car && picked.items.length === 0 && fleetCount > 0 ? <T size={12.5} tone="dim" style={{ marginTop: sc(8) }}>Tap an available vehicle to start a booking for this day.</T> : null}
        </>
      ) : <Card style={{ marginTop: sc(18) }}><T size={14} tone="dim">Choose a day to see vehicle availability.</T></Card>}

      {!!grid.holidays.length ? (
        <>
          <Section title="Holidays this month" />
          {grid.holidays.map(holiday => (
            <Row key={holiday.date + holiday.name} dot={t.red} title={`${Number(holiday.date.slice(8))} ${grid.title.split(' ')[0]}`}
              sub={`${holiday.name}${holiday.tbc ? ' · date to be confirmed' : ''}`} last />
          ))}
          <T size={12} tone="dim" style={{ marginTop: sc(4) }}>Idd dates can differ by a day; correct them on the computer.</T>
        </>
      ) : null}

      {!!form && <EntryForm request={form} onClose={() => setForm(null)} onSaved={async (result, more) => { if (!more) setForm(null); await load(); }} />}
    </ScrollView>
  );
}
