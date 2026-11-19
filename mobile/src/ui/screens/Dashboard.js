import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useSession } from '../session.js';
import { useUI } from '../look.js';
import { Btn, Card, PageHead, Progress, Section, T, TableCard } from '../kit.js';
import { buildDashboardData } from '../dashboardData.js';
import { HOME_LISTS } from '../homeData.js';
import { dsh } from '../dates.js';
import { todayISO } from '../forms.js';
import { fmt } from '../tables.js';
import { kshShort } from '../money.js';
import { openRecord } from '../RecordPage.js';
import Icon from '../Icon.js';

const compactMoney = value => kshShort(value);

function TrendCard({ months }) {
  const { t, s: sc } = useUI();
  const [range, setRange] = useState(6);
  const [selected, setSelected] = useState('');
  const visible = months.slice(-range);
  const selectedMonth = visible.find(month => month.month === selected) || visible[visible.length - 1];
  const max = Math.max(1, ...visible.flatMap(month => [month.revenue, month.expenses]));
  const x = index => visible.length < 2 ? 170 : 28 + (index * 284) / (visible.length - 1);
  const y = value => 112 - (Math.max(0, value) / max) * 90;
  const path = (key, months) => months.map(month => `${month === months[0] ? 'M' : 'L'}${x(visible.indexOf(month))} ${y(month[key])}`).join(' ');
  const history = visible.slice(0, -1), currentSegment = visible.slice(-2);
  const revenue = visible.reduce((sum, month) => sum + month.revenue, 0);
  const expenses = visible.reduce((sum, month) => sum + month.expenses, 0);
  const margin = revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : 0;
  const showLabel = (label, value, tone) => (
    <View style={{ flex: 1 }}>
      <T size={12} tone="dim">{label}</T>
      <T size={15} weight="700" tone={tone} numberOfLines={1}>{compactMoney(value)}</T>
    </View>
  );

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <T size={16} weight="700">Revenue &amp; expenses</T>
          <T size={12.5} tone="dim" style={{ marginTop: sc(2) }}>Select a month to inspect its totals</T>
        </View>
        <View style={{ flexDirection: 'row', gap: sc(6) }}>
          {[6, 12].map(value => (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: range === value }} onPress={() => setRange(value)}
              style={{ borderRadius: sc(14), paddingVertical: sc(6), paddingHorizontal: sc(10), backgroundColor: range === value ? t.goldbg : t.card2 }}>
              <T size={12} weight="700" tone={range === value ? 'gold' : 'dim'}>{value}m</T>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ marginTop: sc(12) }}>
        <Svg width="100%" height={sc(142)} viewBox="0 0 340 142" preserveAspectRatio="none" accessibilityLabel="Revenue and expense trend chart">
          {[22, 67, 112].map(lineY => <Line key={lineY} x1="24" x2="324" y1={lineY} y2={lineY} stroke={t.line} strokeWidth="1" />)}
          {history.length ? <Path d={path('revenue', history)} fill="none" stroke={t.goldt} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {history.length > 1 ? <Path d={path('expenses', history)} fill="none" stroke={t.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {currentSegment.length === 2 ? <>
            <Path d={path('revenue', currentSegment)} fill="none" stroke={t.goldt} strokeWidth="3" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={path('expenses', currentSegment)} fill="none" stroke={t.red} strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" />
          </> : null}
          {visible.map((month, index) => (
            <Circle key={month.month} cx={x(index)} cy={y(month.revenue)} r={selectedMonth && selectedMonth.month === month.month ? 5 : 3}
              onPress={() => setSelected(month.month)}
              fill={selectedMonth && selectedMonth.month === month.month ? t.goldt : t.card} stroke={t.goldt} strokeWidth="2" />
          ))}
          {visible.map((month, index) => (
            <SvgText key={`label-${month.month}`} x={x(index)} y="136" fill={t.dim} fontSize={visible.length > 6 ? 9 : 10} textAnchor="middle">
              {month.label.split(' ')[0].slice(0, 3)}
            </SvgText>
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', gap: sc(18), marginTop: sc(2), marginBottom: sc(14) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(6) }}><View style={{ width: sc(8), height: sc(8), borderRadius: sc(4), backgroundColor: t.goldt }} /><T size={12} tone="dim">Revenue</T></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sc(6) }}><View style={{ width: sc(8), height: sc(8), borderRadius: sc(4), backgroundColor: t.red }} /><T size={12} tone="dim">Expenses</T></View>
      </View>
      {selectedMonth ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.line, paddingTop: sc(12) }}>
          <T size={13} weight="700" style={{ marginBottom: sc(10) }}>{selectedMonth.label}</T>
          <View style={{ flexDirection: 'row', gap: sc(10) }}>
            {showLabel('Revenue', selectedMonth.revenue, 'gold')}
            {showLabel('Expenses', selectedMonth.expenses, 'red')}
            {showLabel('Net margin', selectedMonth.revenue - selectedMonth.expenses, selectedMonth.revenue >= selectedMonth.expenses ? 'green' : 'red')}
          </View>
          <T size={12} tone="dim" style={{ marginTop: sc(10) }}>Period net margin: {margin}% ({fmt(revenue - expenses)} across {range} months)</T>
        </View>
      ) : <T tone="dim">No monthly figures yet.</T>}
    </Card>
  );
}

function MetricCard({ icon, label, value, foot, accent, onPress }) {
  const { t, s: sc } = useUI();
  return (
    <Card accent={accent} onPress={onPress} style={{ width: '48.5%', minHeight: sc(132), marginBottom: sc(10), padding: sc(14) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T size={12.5} weight="600" tone="dim" style={{ flex: 1, paddingRight: sc(5) }}>{label}</T>
        <Icon name={icon} size={19} color={accent || t.goldt} />
      </View>
      <T size={20} weight="700" mono numberOfLines={1} style={{ marginTop: sc(10) }}>{value}</T>
      <T size={11.5} tone="dim" numberOfLines={2} style={{ marginTop: sc(4) }}>{foot}</T>
    </Card>
  );
}

export default function Dashboard() {
  const S = useSession(), { t, s: sc } = useUI(), st = S.status;
  const [data, setData] = useState(null), [error, setError] = useState(null);
  const stamp = st ? `${st.lastSyncAt || ''}|${JSON.stringify(st.counts || {})}|${S.version}` : String(S.version);
  const load = useCallback(async () => {
    setError(null);
    const records = await Promise.all(HOME_LISTS.map(list => S.app.records.all(list)));
    setData(Object.fromEntries(HOME_LISTS.map((list, index) => [list, records[index]])));
  }, [S.app]);
  useEffect(() => { load().catch(reason => { setError(reason); S.notify(reason, 'Dashboard could not be read'); }); }, [load, stamp]);

  const today = todayISO();
  const dashboard = useMemo(() => (data ? buildDashboardData(data, today) : null), [data, today]);
  if (!dashboard) {
    return (
      <ScrollView contentContainerStyle={{ padding: sc(16), paddingBottom: sc(28) }}>
        <PageHead eyebrow="All-time totals" title="Dashboard" />
        <Card>
          <T size={15} tone={error ? 'red' : 'dim'}>{error ? `Dashboard could not be read: ${error.message}` : 'Loading your records…'}</T>
          {error ? <Btn go label="Try again" onPress={() => load().catch(reason => { setError(reason); S.notify(reason, 'Dashboard could not be read'); })} style={{ marginTop: sc(12) }} /> : null}
        </Card>
      </ScrollView>
    );
  }

  const { metrics } = dashboard;
  const cards = [
    { icon: 'car', label: 'Vehicles', value: String(metrics.vehicles), foot: 'Fleet size · all vehicles', accent: t.gold, screen: 'vehicles' },
    { icon: 'key', label: 'Currently on rent', value: String(metrics.onRent), foot: 'Active rentals underway', accent: t.blue, screen: 'rentals' },
    { icon: 'bk', label: 'Upcoming bookings', value: String(metrics.bookings), foot: 'Confirmed and pending', accent: t.orange, screen: 'bookings' },
    { icon: 'chart', label: 'Billed all time', value: compactMoney(metrics.billed), foot: 'Across all recorded rentals', accent: t.gold, screen: 'performance' },
    { icon: 'wallet', label: 'Received all time', value: compactMoney(metrics.received), foot: 'Payments recorded', accent: t.green, screen: 'payments' },
    { icon: 'fuel', label: 'Fuel all time', value: compactMoney(metrics.fuel), foot: 'Fuel expense records', accent: t.orange, screen: 'fuel' },
    { icon: 'chart', label: 'Net income', value: compactMoney(metrics.net), foot: 'Billed less recorded expenses', accent: t.green, screen: 'performance' }
  ];
  const maxNet = Math.max(0, ...dashboard.byCar.map(car => car.net));

  return (
    <ScrollView contentContainerStyle={{ padding: sc(16), paddingBottom: sc(28) }} showsVerticalScrollIndicator={false}>
      <PageHead eyebrow="All-time totals" title="Dashboard" />
      <T size={13.5} tone="dim" style={{ marginTop: -sc(8), marginBottom: sc(14) }}>Live records shared with the computer. Tap a card to open its records.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {cards.map(card => <MetricCard key={card.label} {...card} onPress={() => S.go(card.screen)} />)}
      </View>
      <Card accent={t.red} onPress={() => S.go('overdue')} style={{ marginTop: sc(2), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: sc(10) }}>
          <T size={13} tone="dim">Outstanding payments</T>
          <T size={23} weight="700" mono tone="red" style={{ marginTop: sc(3) }}>{compactMoney(metrics.owed)}</T>
        </View>
        <Icon name="r" size={21} color={t.red} />
      </Card>

      <Section title="Revenue & expenses" />
      <TrendCard months={dashboard.trend} />

      <Section title={`By car · ${dashboard.currentMonth}`} action="Fuel" onAction={() => S.go('fuel')} />
      {dashboard.byCar.length ? (
        <Card>
          {dashboard.byCar.map((car, index) => (
            <Pressable key={String(car.vehicleId)} accessibilityRole="button" onPress={() => S.go('performance')}
              style={{ paddingBottom: sc(12), marginBottom: sc(12), borderBottomWidth: index === dashboard.byCar.length - 1 ? 0 : 1, borderBottomColor: t.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sc(8) }}>
                <View style={{ flex: 1 }}>
                  <T size={14} weight="700" numberOfLines={1}>{car.reg} · {car.vehicle}</T>
                  <T size={12} tone="dim" style={{ marginTop: sc(2) }}>{car.rentals} rentals · {car.days} days · {fmt(car.amount)} billed</T>
                </View>
                <T size={13} weight="700" mono tone={car.net >= 0 ? 'green' : 'red'}>{fmt(car.net)}</T>
              </View>
              <Progress pct={maxNet > 0 ? (Math.max(0, car.net) / maxNet) * 100 : 0} />
            </Pressable>
          ))}
        </Card>
      ) : <Card><T size={14} tone="dim">No rentals recorded this month.</T></Card>}

      <Section title="Currently on rent" action="All rentals" onAction={() => S.go('rentals')} />
      {dashboard.currentRentals.length ? (
        <TableCard head={[['Vehicle'], ['Make / model'], ['Client'], ['Contract'], ['Return'], ['Daily rate', true]]}
          rows={dashboard.currentRentals.map(rental => [rental.reg, rental.vehicle, rental.client, rental.contract, dsh(rental.due), fmt(rental.rate)])}
          onRow={index => openRecord(S, { list: 'rentals', id: dashboard.currentRentals[index].id, title: `${dashboard.currentRentals[index].reg} · ${dashboard.currentRentals[index].client}` })} />
      ) : <Card><T size={14} tone="dim">No vehicles are currently out on rent.</T></Card>}

      <Section title="Upcoming bookings" action="All bookings" onAction={() => S.go('bookings')} />
      {dashboard.bookings.length ? (
        <TableCard head={[['Vehicle'], ['Make / model'], ['Client'], ['Pickup'], ['Status']]}
          rows={dashboard.bookings.map(booking => [booking.reg, booking.vehicle, booking.client, dsh(booking.pickup), booking.status])}
          onRow={index => openRecord(S, { list: 'bookings', id: dashboard.bookings[index].id, title: `${dashboard.bookings[index].reg} · ${dashboard.bookings[index].client}` })} />
      ) : <Card><T size={14} tone="dim">No upcoming bookings.</T></Card>}
    </ScrollView>
  );
}
