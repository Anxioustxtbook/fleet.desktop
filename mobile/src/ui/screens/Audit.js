/* Audit: everything that stands between the records and 100% fluency, in one place.
   Who has not paid us, what we have not paid (sub-hire cars, sub-hire drivers, the fuel station), rent not yet entered, and records
   with something missing. The money rows can be settled on the spot (Record payment, Mark paid, Add rent). Analysis is a button here. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Card, Txt } from '../parts.js';
import { useSession, useTheme } from '../session.js';
import Skeleton from '../Skeleton.js';
import { AUDIT_LISTS, auditHeadline, buildAudit, rentPreset } from '../audit.js';
import { fmt, monthName } from '../tables.js';
import { formIdFor, markPaidPatch, todayISO } from '../forms.js';
import { RADIUS } from '../theme.js';
import RecordView from './RecordView.js';
import EntryForm from './EntryForm.js';

function Stat({ label, value, tone, t }) {
  return (
    <View style={{ width: '50%', paddingVertical: 5, paddingRight: 8 }}>
      <Text style={{ color: t.inkFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: tone || t.ink, fontSize: 16, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

export default function Audit() {
  const s = useSession(), t = useTheme();
  const [data, setData] = useState(null), [openSec, setOpenSec] = useState({ owing: true }), [openGroup, setOpenGroup] = useState({});
  const [open, setOpen] = useState(null), [form, setForm] = useState(null);
  const stamp = s.status ? `${s.status.lastSyncAt || ''}|${JSON.stringify(s.status.counts || {})}` : '';
  const load = useCallback(async () => { const d = {}; for (const l of AUDIT_LISTS) d[l] = await s.app.records.all(l); setData(d); }, [s.app]);
  useEffect(() => { load().catch(e => s.notify(e, 'The audit could not be read')); }, [load, stamp]);
  const audit = useMemo(() => (data ? buildAudit(data, { reviewOpen: s.status ? s.status.reviewOpen : 0 }) : null), [data, s.status]);
  if (!audit) return <Skeleton kind="cards" />;
  const m = audit.money, toneOf = x => ({ bad: t.red, amber: t.amber, ok: t.green }[x] || t.inkDim);

  const markPaid = (item, kind) => {
    const what = kind === 'owner' ? 'the owner' : 'the driver';
    Alert.alert('Mark as paid?', `${item.title}\n${fmt(item.amount)} to ${kind === 'owner' ? item.owner : item.driver}.\n\nThis records that ${what} has been paid today.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark paid', onPress: async () => {
        try { await s.app.records.update('rentals', item.action.rentalId, markPaidPatch(kind, await s.app.records.get('rentals', item.action.rentalId), todayISO())); await s.refresh(); await load(); }
        catch (e) { s.notify(e, 'That was not saved'); }
      } }
    ]);
  };
  const act = async item => {
    const a = item.action; if (!a) return;
    if (a.kind === 'pay') setForm({ form: 'payments', preset: { values: { rentalId: a.rentalId, amount: String(a.amount) } } });
    else if (a.kind === 'ownerPaid') markPaid(item, 'owner');
    else if (a.kind === 'driverPaid') markPaid(item, 'driver');
    else if (a.kind === 'topup') setForm({ form: 'fuelTopup', preset: { values: { amount: String(a.amount) } } });
    else if (a.kind === 'addRent') setForm({ form: 'expenses', preset: rentPreset(a.month, a.amount) });
    else if (a.kind === 'fix') { const r = await s.app.records.get(item.list, item.id), id = formIdFor(item.list, r); if (r && id) setForm({ form: id, record: r }); else setOpen(item); }
  };

  const row = item => (
    <View key={item.key} style={{ paddingVertical: 9, borderTopColor: t.line, borderTopWidth: 1 }}>
      <Pressable accessibilityRole="button" disabled={!item.list} onPress={() => setOpen(item)}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>{item.title}</Text>
            {!!item.sub && <Text style={{ color: t.inkDim, fontSize: 12.5, marginTop: 2 }} numberOfLines={2}>{item.sub}</Text>}
            {!!item.what && <Text style={{ color: t.amber, fontSize: 13, marginTop: 3 }}>Missing: {item.what.join(', ')}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {item.amount > 0 && <Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }}>{fmt(item.amount)}</Text>}
            {!!item.tag && !item.what && <Text style={{ color: toneOf(item.tone), fontSize: 12, fontWeight: '700', marginTop: 2 }}>{item.tag}</Text>}
          </View>
        </View>
      </Pressable>
      {!!item.action && (
        <Pressable accessibilityRole="button" onPress={() => act(item)} style={{ alignSelf: 'flex-start', marginTop: 7, borderWidth: 1, borderColor: t.green, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14 }}>
          <Text style={{ color: t.green, fontSize: 13.5, fontWeight: '700' }}>{item.action.label}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ color: audit.clear ? t.green : t.ink, fontSize: 34, fontWeight: '800' }}>{audit.fluency}%</Text>
            <Text style={{ color: t.inkDim, fontSize: 14, marginLeft: 8, marginBottom: 6, flex: 1 }}>of records settled and complete</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.panel3, marginTop: 4, overflow: 'hidden' }}><View style={{ width: `${audit.fluency}%`, height: 8, backgroundColor: audit.clear ? t.green : t.amber }} /></View>
          <Txt tone={audit.clear ? 'ok' : 'dim'} bold style={{ marginTop: 8 }}>{auditHeadline(audit)}</Txt>
          <Txt tone="faint" size={12} style={{ marginTop: 4 }}>{audit.flagged} of {audit.examined} rentals, payments, expenses and vehicles have something pending or missing. It reaches 100% only when nothing is left.</Txt>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Pressable accessibilityRole="button" onPress={() => s.go('analysis')} style={{ flex: 1, borderWidth: 1, borderColor: t.line, backgroundColor: t.panel2, borderRadius: RADIUS.button, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}><Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }}>Analysis</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => s.go('payments')} style={{ flex: 1, borderWidth: 1, borderColor: t.line, backgroundColor: t.panel2, borderRadius: RADIUS.button, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }}>Payments</Text></Pressable>
          </View>
        </Card>

        <Card>
          <Txt bold size={16} style={{ marginBottom: 6 }}>Paid and not paid</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Stat t={t} label="Billed" value={fmt(m.billed)} />
            <Stat t={t} label="Received" value={fmt(m.paid)} tone={t.green} />
            <Stat t={t} label="Not yet paid to us" value={fmt(m.owed)} tone={m.owed ? t.red : t.green} />
            <Stat t={t} label="Collected" value={`${m.collectedPct}%`} />
            <Stat t={t} label="Cars: paid" value={fmt(m.ownersPaid)} tone={t.green} />
            <Stat t={t} label="Cars: still to pay" value={fmt(m.ownersOwed)} tone={m.ownersOwed ? t.amber : t.green} />
            <Stat t={t} label="Drivers: paid" value={fmt(m.driversPaid)} tone={t.green} />
            <Stat t={t} label="Drivers: still to pay" value={fmt(m.driversOwed)} tone={m.driversOwed ? t.amber : t.green} />
            {m.fuelOwed > 0 && <Stat t={t} label="Owed to fuel station" value={fmt(m.fuelOwed)} tone={t.red} />}
          </View>
          <Txt tone="faint" size={12} style={{ marginTop: 4 }}>{m.settled} of {m.rentals} rentals are fully paid.</Txt>
        </Card>

        {audit.reviewOpen > 0 && (
          <Pressable accessibilityRole="button" onPress={() => s.go('review')}>
            <Card style={{ borderColor: t.amber }}><Txt bold>{audit.reviewOpen} on the Review list</Txt><Txt tone="dim" size={13.5}>Records held aside or replaced during a sync. Open the list to settle them.</Txt></Card>
          </Pressable>
        )}

        {audit.sections.map(sec => {
          const on = !!openSec[sec.id];
          return (
            <Card key={sec.id} style={{ padding: 0, overflow: 'hidden' }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setOpenSec(o => ({ ...o, [sec.id]: !o[sec.id] }))} style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700' }}>{sec.title}</Text>
                  <Text style={{ color: sec.count ? toneOf(sec.tone) : t.green, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{sec.count ? `${sec.count} to settle${sec.amount ? ' · ' + fmt(sec.amount) : ''}` : 'All clear'}</Text>
                </View>
                <Text style={{ color: t.inkFaint, fontSize: 13 }}>{on ? 'Hide' : 'Show'}</Text>
              </Pressable>
              {on && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 12, borderTopColor: t.line, borderTopWidth: 1 }}>
                  <Txt tone="dim" size={13} style={{ marginTop: 8 }}>{sec.blurb}</Txt>
                  {!sec.groups.length && <Txt tone="ok" bold style={{ marginTop: 8 }}>Nothing left here.</Txt>}
                  {sec.groups.map(g => {
                    const gk = sec.id + '|' + g.key, gon = openGroup[gk] != null ? openGroup[gk] : sec.groups.length === 1;
                    return (
                      <View key={g.key} style={{ marginTop: 10 }}>
                        <Pressable accessibilityRole="button" onPress={() => setOpenGroup(o => ({ ...o, [gk]: !gon }))} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.panel2, borderRadius: 8, padding: 10 }}>
                          <View style={{ flex: 1 }}><Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{g.title}</Text><Text style={{ color: t.inkDim, fontSize: 12.5 }}>{g.sub}</Text></View>
                          {g.amount > 0 && <Text style={{ color: t.ink, fontSize: 15, fontWeight: '700', marginRight: 8 }}>{fmt(g.amount)}</Text>}
                          <Text style={{ color: t.inkFaint, fontSize: 12 }}>{gon ? 'Hide' : 'Show'}</Text>
                        </Pressable>
                        {gon && g.items.map(row)}
                      </View>
                    );
                  })}
                  {!!sec.extra && <Txt tone="faint" size={12.5} style={{ marginTop: 10 }}>{sec.extra}</Txt>}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
      <RecordView item={open} data={data} onClose={() => setOpen(null)} onChanged={load} />
      {!!form && <EntryForm request={form} onClose={() => setForm(null)} onSaved={async (r, more) => { if (!more) setForm(null); await load(); }} />}
    </View>
  );
}
