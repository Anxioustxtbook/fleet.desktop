/* Pilot: the Overview only, as agreed. Opens without a PIN (the phone has no admin).
   The desktop's monthly table, one card per month, newest first; tap a month to see every column. Read-only. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card, Txt } from '../parts.js';
import { useSession, useTheme } from '../session.js';
import Skeleton from '../Skeleton.js';
import { buildOverview } from '../overview.js';
import { fmt } from '../tables.js';
import RentAlert from '../RentAlert.js';

export default function Pilot() {
  const s = useSession(), t = useTheme();
  const [data, setData] = useState(null), [openMonth, setOpenMonth] = useState('');
  const stamp = s.status ? `${s.status.lastSyncAt || ''}|${JSON.stringify(s.status.counts || {})}` : '';
  const load = useCallback(async () => { const d = {}; for (const l of ['rentals', 'expenses', 'insurance', 'vehicles', 'drivers', 'clients']) d[l] = await s.app.records.all(l); setData(d); }, [s.app]);
  useEffect(() => { load().catch(e => s.notify(e, 'The Overview could not be read')); }, [load, stamp]);
  const ov = useMemo(() => (data ? buildOverview(data) : null), [data]);
  if (!ov) return <Skeleton kind="cards" />;
  if (ov.empty) return <ScrollView contentContainerStyle={{ padding: 14 }}><Card><Txt bold size={17}>Overview</Txt><Txt tone="dim" style={{ marginTop: 6 }}>{ov.message}</Txt></Card></ScrollView>;
  const line = (label, value, bold, tone) => <View key={label} style={{ flexDirection: 'row', paddingVertical: 4 }}><Txt tone={tone || 'dim'} style={{ flex: 1 }} bold={bold}>{label}</Txt><Txt bold={bold}>{value}</Txt></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
      <RentAlert data={data} onSaved={load} />
      <Card>
        <Txt bold size={17}>Overview</Txt>
        <Txt tone="dim" size={13} style={{ marginBottom: 8 }}>All months, {ov.months.length} in total</Txt>
        {line('Billed', fmt(ov.totals.billed))}{line('Total spent', fmt(ov.totals.spent))}{line('Billed less spent', fmt(ov.totals.net), true, ov.totals.net < 0 ? 'bad' : 'ok')}
      </Card>
      {ov.months.map(m => {
        const on = openMonth === m.month;
        return (
          <Pressable key={m.month} accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setOpenMonth(on ? '' : m.month)}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700', flex: 1 }}>{m.label}</Text>
                <Text style={{ color: t.inkFaint, fontSize: 13 }}>{on ? 'Hide' : 'Details'}</Text>
              </View>
              <View style={{ marginTop: 6 }}>{line('Billed', fmt(m.billed))}{line('Total spent', fmt(m.spent), true)}</View>
              {on && <View style={{ marginTop: 6, paddingTop: 6, borderTopColor: t.line, borderTopWidth: 1 }}>
                {m.cols.filter(c => c.value).map(c => line(c.label, fmt(c.value)))}
                {!m.cols.some(c => c.value) && <Txt tone="faint">No spending recorded.</Txt>}
                {line('Rentals', String(m.rentals))}
              </View>}
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
